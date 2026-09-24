from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.encryption import decrypt_token, encrypt_token
from app.db.models import Account, Institution, PlaidItem, Transaction
from app.services.categorizer import categorize_unlabeled, predict_one, apply_prediction
from app.services.csv_import import get_or_create_category, infer_txn_kind
from app.services.merchant import normalize_merchant
from app.services.money import dollars_to_cents


class PlaidNotConfigured(RuntimeError):
    pass


def _client():
    settings = get_settings()
    if not settings.plaid_client_id or not settings.plaid_secret:
        raise PlaidNotConfigured("Plaid credentials are not set in .env")
    import plaid
    from plaid.api import plaid_api

    host_map = {
        "sandbox": plaid.Environment.Sandbox,
        "production": plaid.Environment.Production,
        "development": getattr(plaid.Environment, "Development", plaid.Environment.Sandbox),
    }
    host = host_map.get(settings.plaid_env.lower(), plaid.Environment.Sandbox)
    configuration = plaid.Configuration(
        host=host,
        api_key={"clientId": settings.plaid_client_id, "secret": settings.plaid_secret},
    )
    return plaid_api.PlaidApi(plaid.ApiClient(configuration))


def plaid_configured() -> bool:
    s = get_settings()
    return bool(s.plaid_client_id and s.plaid_secret)


def create_link_token(redirect_uri: str | None = None) -> str:
    from plaid.model.country_code import CountryCode
    from plaid.model.link_token_create_request import LinkTokenCreateRequest
    from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
    from plaid.model.products import Products

    settings = get_settings()
    client = _client()
    products = [Products(p) for p in settings.plaid_product_list]
    countries = [CountryCode(c) for c in settings.plaid_country_codes.split(",") if c.strip()]
    kwargs = dict(
        user=LinkTokenCreateRequestUser(client_user_id="local-household"),
        client_name="Finance Tracker",
        products=products,
        country_codes=countries,
        language=settings.plaid_language,
    )
    uri = (redirect_uri or settings.plaid_redirect_uri or "").strip()
    if uri:
        kwargs["redirect_uri"] = uri
    try:
        from plaid.model.link_token_create_request_transactions import LinkTokenCreateRequestTransactions

        kwargs["transactions"] = LinkTokenCreateRequestTransactions(days_requested=730)
    except Exception:
        pass
    request = LinkTokenCreateRequest(**kwargs)
    response = client.link_token_create(request)
    return response["link_token"]


def _institution_for_plaid(db: Session, name: str) -> Institution:
    inst = db.query(Institution).filter_by(name=name).one_or_none()
    if inst:
        return inst
    inst = Institution(name=name)
    db.add(inst)
    db.flush()
    return inst


def _map_account_kind(plaid_type: str, subtype: str | None) -> str:
    t = (plaid_type or "").lower()
    st = (subtype or "").lower()
    if t == "credit":
        return "credit"
    if t == "investment" or st in {"brokerage", "ira", "401k", "529"}:
        return "brokerage"
    if t in {"depository", "loan"}:
        return "depository"
    return "depository"


def exchange_public_token(db: Session, public_token: str) -> PlaidItem:
    from plaid.model.accounts_get_request import AccountsGetRequest
    from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest

    client = _client()
    settings = get_settings()
    exchange = client.item_public_token_exchange(
        ItemPublicTokenExchangeRequest(public_token=public_token)
    )
    access_token = exchange["access_token"]
    item_id = exchange["item_id"]
    existing = db.query(PlaidItem).filter_by(item_id=item_id).one_or_none()
    if existing:
        existing.access_token_encrypted = encrypt_token(access_token)
        existing.status = "active"
        existing.products = settings.plaid_product_list
        item = existing
    else:
        item = PlaidItem(
            item_id=item_id,
            access_token_encrypted=encrypt_token(access_token),
            status="active",
            products=settings.plaid_product_list,
        )
        db.add(item)
        db.flush()

    accounts_resp = client.accounts_get(AccountsGetRequest(access_token=access_token))
    inst_name = "Plaid"
    inst_id = None
    try:
        inst_id = accounts_resp["item"].get("institution_id")
        inst_name = accounts_resp["item"].get("institution_name") or inst_id or "Plaid"
    except Exception:
        pass
    if inst_id and (not inst_name or inst_name == inst_id):
        try:
            from plaid.model.country_code import CountryCode
            from plaid.model.institutions_get_by_id_request import InstitutionsGetByIdRequest

            countries = [CountryCode(c) for c in settings.plaid_country_codes.split(",") if c.strip()]
            inst_resp = client.institutions_get_by_id(
                InstitutionsGetByIdRequest(institution_id=inst_id, country_codes=countries)
            )
            inst_name = inst_resp["institution"]["name"]
        except Exception:
            pass
    item.institution_name = str(inst_name)
    institution = _institution_for_plaid(db, item.institution_name or "Plaid")
    for acct in accounts_resp["accounts"]:
        plaid_id = acct["account_id"]
        kind = _map_account_kind(str(acct["type"]), str(acct.get("subtype") or ""))
        mask = acct.get("mask")
        name = acct.get("official_name") or acct.get("name") or f"{item.institution_name} {mask or ''}"
        row = db.query(Account).filter_by(plaid_account_id=plaid_id).one_or_none()
        if not row and mask:
            row = (
                db.query(Account)
                .filter_by(last4=str(mask), kind=kind, institution_id=institution.id)
                .one_or_none()
            )
        if row:
            row.plaid_account_id = plaid_id
            row.plaid_item_id = item.id
            row.mask = str(mask) if mask else row.mask
            row.last4 = str(mask) if mask else row.last4
            row.official_name = acct.get("official_name")
            row.is_active = True
        else:
            db.add(
                Account(
                    institution_id=institution.id,
                    name=str(name).strip(),
                    last4=str(mask) if mask else None,
                    kind=kind,
                    plaid_account_id=plaid_id,
                    plaid_item_id=item.id,
                    mask=str(mask) if mask else None,
                    official_name=acct.get("official_name"),
                )
            )
    db.commit()
    db.refresh(item)
    return item


def _upsert_plaid_transaction(db: Session, account: Account, txn) -> None:
    plaid_id = txn["transaction_id"]
    amount_cents = dollars_to_cents(txn["amount"])
    name = txn.get("merchant_name") or txn.get("name") or ""
    pfc = None
    try:
        pfc_obj = txn.get("personal_finance_category")
        if pfc_obj:
            pfc = pfc_obj.get("primary") if isinstance(pfc_obj, dict) else getattr(pfc_obj, "primary", None)
    except Exception:
        pfc = None
    raw_date = txn.get("date") or txn.get("authorized_date")
    if isinstance(raw_date, str):
        txn_date = date.fromisoformat(raw_date)
    else:
        txn_date = raw_date
    pending = bool(txn.get("pending"))
    existing = db.query(Transaction).filter_by(account_id=account.id, external_id=plaid_id).one_or_none()
    kind = infer_txn_kind(str(name), None, amount_cents, None)
    if existing:
        existing.amount_cents = amount_cents
        existing.date = txn_date
        existing.description_raw = str(name)
        existing.merchant_norm = normalize_merchant(str(name))
        existing.pending = pending
        existing.plaid_pfc_primary = pfc
        existing.txn_kind = kind if existing.who_source != "user" else existing.txn_kind
        if existing.category_source != "user" or existing.who_source != "user":
            pred = predict_one(
                db,
                merchant_norm=existing.merchant_norm,
                description=existing.description_raw,
                plaid_pfc=pfc,
            )
            apply_prediction(existing, pred)
        return
    row = Transaction(
        account_id=account.id,
        source="plaid",
        external_id=plaid_id,
        date=txn_date,
        description_raw=str(name),
        merchant_norm=normalize_merchant(str(name)),
        amount_cents=amount_cents,
        txn_kind=kind,
        pending=pending,
        who="shared",
        who_source="rule",
        plaid_pfc_primary=pfc,
    )
    pred = predict_one(db, merchant_norm=row.merchant_norm, description=row.description_raw, plaid_pfc=pfc)
    apply_prediction(row, pred, overwrite_user=True)
    db.add(row)


def sync_item(db: Session, item: PlaidItem) -> dict:
    from plaid.model.transactions_sync_request import TransactionsSyncRequest

    client = _client()
    token = decrypt_token(item.access_token_encrypted)
    cursor = item.sync_cursor or ""
    added, modified, removed = [], [], []
    has_more = True
    while has_more:
        kwargs = {"access_token": token}
        if cursor:
            kwargs["cursor"] = cursor
        resp = client.transactions_sync(TransactionsSyncRequest(**kwargs))
        added.extend(resp["added"])
        modified.extend(resp["modified"])
        removed.extend(resp["removed"])
        has_more = resp["has_more"]
        cursor = resp["next_cursor"]
    accounts = {a.plaid_account_id: a for a in db.query(Account).filter_by(plaid_item_id=item.id).all()}
    for txn in list(added) + list(modified):
        acct = accounts.get(txn["account_id"])
        if not acct:
            continue
        _upsert_plaid_transaction(db, acct, txn)
    for txn in removed:
        tid = txn["transaction_id"] if isinstance(txn, dict) else getattr(txn, "transaction_id", None)
        if not tid:
            continue
        db.query(Transaction).filter_by(external_id=tid, source="plaid").delete()
    item.sync_cursor = cursor
    item.last_synced_at = datetime.utcnow()
    categorize_unlabeled(db)
    db.commit()
    return {"added": len(added), "modified": len(modified), "removed": len(removed)}


def sync_all(db: Session) -> dict:
    items = db.query(PlaidItem).filter_by(status="active").all()
    totals = {"items": 0, "added": 0, "modified": 0, "removed": 0, "errors": []}
    for item in items:
        try:
            result = sync_item(db, item)
            totals["items"] += 1
            totals["added"] += result["added"]
            totals["modified"] += result["modified"]
            totals["removed"] += result["removed"]
        except Exception as exc:  # noqa: BLE001
            totals["errors"].append(f"{item.item_id}: {exc}")
    return totals


def build_snapshot(db: Session) -> dict:
    items = db.query(PlaidItem).all()
    accounts = db.query(Account).filter(Account.plaid_account_id.isnot(None)).all()
    account_ids = [a.id for a in accounts]
    txns = []
    if account_ids:
        txns = (
            db.query(Transaction)
            .filter(Transaction.account_id.in_(account_ids), Transaction.source == "plaid")
            .order_by(Transaction.date.desc(), Transaction.id.desc())
            .all()
        )
    plaid_by_account = {a.id: a.plaid_account_id for a in accounts}
    return {
        "items": [
            {
                "id": r.id,
                "item_id": r.item_id,
                "institution_name": r.institution_name,
                "status": r.status,
                "products": r.products or [],
                "last_synced_at": r.last_synced_at.isoformat() if r.last_synced_at else None,
            }
            for r in items
        ],
        "accounts": [
            {
                "plaid_account_id": a.plaid_account_id,
                "plaid_item_id": a.plaid_item_id,
                "name": a.name,
                "last4": a.last4,
                "kind": a.kind,
                "institution": a.institution.name if a.institution else "",
                "is_active": a.is_active,
            }
            for a in accounts
            if a.plaid_account_id
        ],
        "transactions": [
            {
                "external_id": t.external_id,
                "plaid_account_id": plaid_by_account.get(t.account_id),
                "date": t.date.isoformat() if t.date else None,
                "description": t.description_raw,
                "merchant_norm": t.merchant_norm,
                "amount_cents": t.amount_cents,
                "txn_kind": t.txn_kind,
                "pending": t.pending,
                "who": t.who,
                "who_source": t.who_source,
                "category": t.category.name if t.category else None,
                "category_source": t.category_source,
                "category_confidence": t.category_confidence,
                "notes": t.notes,
                "plaid_pfc_primary": t.plaid_pfc_primary,
            }
            for t in txns
            if plaid_by_account.get(t.account_id)
        ],
    }
