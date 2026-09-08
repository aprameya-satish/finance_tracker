from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.engine import get_db
from app.db.models import Budget
from app.schemas.dtos import BudgetCopyIn, BudgetIn
from app.services.budget import copy_budgets, month_budget_report

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("/{year_month}")
def get_budgets(year_month: str, include_pending: bool = False, db: Session = Depends(get_db)):
    return month_budget_report(db, year_month, include_pending)


@router.put("")
def upsert_budget(body: BudgetIn, db: Session = Depends(get_db)):
    row = db.query(Budget).filter_by(year_month=body.year_month, category_id=body.category_id).one_or_none()
    if row:
        row.limit_cents = body.limit_cents
    else:
        row = Budget(year_month=body.year_month, category_id=body.category_id, limit_cents=body.limit_cents)
        db.add(row)
    db.commit()
    return {"ok": True, "id": row.id}


@router.post("/copy")
def copy(body: BudgetCopyIn, db: Session = Depends(get_db)):
    n = copy_budgets(db, body.from_month, body.to_month)
    db.commit()
    return {"copied": n}


@router.delete("/{budget_id}")
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    row = db.query(Budget).filter_by(id=budget_id).one_or_none()
    if not row:
        raise HTTPException(404, "budget not found")
    db.delete(row)
    db.commit()
    return {"ok": True}
