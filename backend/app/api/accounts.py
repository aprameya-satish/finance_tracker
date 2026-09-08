from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.engine import get_db
from app.db.models import Account
from app.schemas.dtos import AccountOut

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountOut])
def list_accounts(db: Session = Depends(get_db)):
    rows = db.query(Account).order_by(Account.name).all()
    return [
        AccountOut(
            id=a.id,
            name=a.name,
            last4=a.last4,
            kind=a.kind,
            institution=a.institution.name if a.institution else "",
            is_active=a.is_active,
            plaid_item_id=a.plaid_item_id,
        )
        for a in rows
    ]
