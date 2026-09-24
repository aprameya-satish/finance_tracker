from datetime import date, datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.engine import Base
from app.db import models  # noqa: F401
from app.db.models import Account, Category, Institution, PlaidItem, Transaction
from app.services.plaid_service import build_snapshot, plaid_configured


def test_plaid_not_configured_without_secrets(monkeypatch):
    monkeypatch.setattr(
        "app.services.plaid_service.get_settings",
        lambda: type("S", (), {"plaid_client_id": "", "plaid_secret": ""})(),
    )
    assert plaid_configured() is False


def test_build_snapshot_uses_plaid_ids(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path}/p.db")
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    inst = Institution(name="Chase")
    db.add(inst)
    db.flush()
    item = PlaidItem(
        item_id="item-abc",
        access_token_encrypted="x",
        status="active",
        products=["transactions"],
        institution_name="Chase",
        last_synced_at=datetime(2026, 4, 1, 12, 0, 0),
    )
    db.add(item)
    db.flush()
    acct = Account(
        institution_id=inst.id,
        name="Chase Sapphire",
        last4="1561",
        kind="credit",
        plaid_account_id="plaid-acc-1",
        plaid_item_id=item.id,
    )
    db.add(acct)
    db.flush()
    groceries = Category(name="Groceries", include_in_budget=True)
    db.add(groceries)
    db.flush()
    db.add(
        Transaction(
            account_id=acct.id,
            source="plaid",
            external_id="txn-1",
            date=date(2026, 4, 1),
            description_raw="WHOLEFDS ATL",
            merchant_norm="WHOLEFDS ATL",
            amount_cents=1295,
            txn_kind="spend",
            pending=False,
            who="A",
            who_source="user",
            category_id=groceries.id,
            category_source="user",
            category_confidence=1,
            plaid_pfc_primary="FOOD_AND_DRINK",
        )
    )
    db.add(
        Transaction(
            account_id=acct.id,
            source="csv",
            external_id="csv-keep",
            date=date(2026, 4, 2),
            description_raw="CSV ONLY",
            merchant_norm="CSV ONLY",
            amount_cents=500,
            txn_kind="spend",
            who="shared",
        )
    )
    db.commit()

    snap = build_snapshot(db)
    assert len(snap["items"]) == 1
    assert snap["accounts"][0]["plaid_account_id"] == "plaid-acc-1"
    assert [t["external_id"] for t in snap["transactions"]] == ["txn-1"]
    assert snap["transactions"][0]["who"] == "A"
    assert snap["transactions"][0]["category"] == "Groceries"
    assert snap["transactions"][0]["plaid_account_id"] == "plaid-acc-1"
