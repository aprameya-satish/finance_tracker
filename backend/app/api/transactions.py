from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.db.engine import get_db
from app.db.models import Transaction
from app.schemas.dtos import BulkWhoIn, TransactionOut, TransactionPatch
from app.services.categorizer import CONFIDENCE_REVIEW, upsert_user_rule

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _to_out(t: Transaction) -> TransactionOut:
    return TransactionOut(
        id=t.id,
        date=t.date,
        description=t.description_raw,
        merchant_norm=t.merchant_norm,
        amount_cents=t.amount_cents,
        txn_kind=t.txn_kind,
        pending=t.pending,
        who=t.who,
        who_source=t.who_source,
        category_id=t.category_id,
        category=t.category.name if t.category else None,
        category_source=t.category_source,
        category_confidence=t.category_confidence,
        notes=t.notes,
        account_id=t.account_id,
        account_name=t.account.name if t.account else "",
        source=t.source,
    )


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    year_month: Optional[str] = None,
    who: Optional[str] = None,
    category_id: Optional[int] = None,
    account_id: Optional[int] = None,
    q: Optional[str] = None,
    review: bool = False,
    db: Session = Depends(get_db),
):
    query = db.query(Transaction).options(joinedload(Transaction.category), joinedload(Transaction.account))
    if year_month:
        y, m = [int(p) for p in year_month.split("-")]
        start = date(y, m, 1)
        end = date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)
        query = query.filter(Transaction.date >= start, Transaction.date < end)
    if who:
        query = query.filter(Transaction.who == who)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if account_id:
        query = query.filter(Transaction.account_id == account_id)
    if q:
        like = f"%{q}%"
        query = query.filter(Transaction.description_raw.ilike(like))
    if review:
        query = query.filter(
            (Transaction.category_id.is_(None))
            | (Transaction.category_confidence.is_(None))
            | (Transaction.category_confidence < CONFIDENCE_REVIEW)
        )
    rows = query.order_by(Transaction.date.desc(), Transaction.id.desc()).limit(2000).all()
    return [_to_out(t) for t in rows]


@router.patch("/{txn_id}", response_model=TransactionOut)
def patch_transaction(txn_id: int, body: TransactionPatch, db: Session = Depends(get_db)):
    txn = db.query(Transaction).filter_by(id=txn_id).one_or_none()
    if not txn:
        raise HTTPException(404, "transaction not found")
    if body.who is not None:
        if body.who not in ("A", "S", "shared"):
            raise HTTPException(400, "who must be A, S, or shared")
        txn.who = body.who
        txn.who_source = "user"
    if body.category_id is not None:
        txn.category_id = body.category_id
        txn.category_source = "user"
        txn.category_confidence = 1.0
    if body.notes is not None:
        txn.notes = body.notes
    if body.txn_kind is not None:
        txn.txn_kind = body.txn_kind
    if body.update_merchant_rule:
        upsert_user_rule(db, txn.merchant_norm, txn.category_id, txn.who)
    db.commit()
    db.refresh(txn)
    return _to_out(txn)


@router.post("/bulk-who", response_model=dict)
def bulk_who(body: BulkWhoIn, db: Session = Depends(get_db)):
    if body.who not in ("A", "S", "shared"):
        raise HTTPException(400, "who must be A, S, or shared")
    rows = db.query(Transaction).filter(Transaction.id.in_(body.ids)).all()
    for txn in rows:
        txn.who = body.who
        txn.who_source = "user"
        if body.update_merchant_rule:
            upsert_user_rule(db, txn.merchant_norm, txn.category_id, txn.who)
    db.commit()
    return {"updated": len(rows)}
