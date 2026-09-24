from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import require_api_key
from app.db.engine import get_db
from app.db.models import PlaidItem
from app.schemas.dtos import LinkTokenIn, LinkTokenOut, PublicTokenIn
from app.services.plaid_service import (
    PlaidNotConfigured,
    build_snapshot,
    create_link_token,
    exchange_public_token,
    plaid_configured,
    sync_all,
    sync_item,
)

router = APIRouter(prefix="/plaid", tags=["plaid"], dependencies=[Depends(require_api_key)])


@router.post("/link-token", response_model=LinkTokenOut)
def link_token(body: LinkTokenIn | None = None):
    if not plaid_configured():
        raise HTTPException(503, "Plaid credentials are not configured")
    try:
        token = create_link_token(body.redirect_uri if body else None)
    except PlaidNotConfigured as exc:
        raise HTTPException(503, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Plaid link token failed: {exc}") from exc
    return LinkTokenOut(link_token=token)


@router.post("/exchange")
def exchange(body: PublicTokenIn, db: Session = Depends(get_db)):
    try:
        item = exchange_public_token(db, body.public_token)
    except PlaidNotConfigured as exc:
        raise HTTPException(503, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Plaid exchange failed: {exc}") from exc
    return {"item_id": item.item_id, "id": item.id}


@router.post("/sync")
def sync(item_id: int | None = None, db: Session = Depends(get_db)):
    try:
        if item_id is not None:
            item = db.query(PlaidItem).filter_by(id=item_id).one_or_none()
            if not item:
                raise HTTPException(404, "plaid item not found")
            return sync_item(db, item)
        return sync_all(db)
    except PlaidNotConfigured as exc:
        raise HTTPException(503, str(exc)) from exc


@router.get("/items")
def list_items(db: Session = Depends(get_db)):
    rows = db.query(PlaidItem).all()
    return [
        {
            "id": r.id,
            "item_id": r.item_id,
            "institution_name": r.institution_name,
            "status": r.status,
            "products": r.products,
            "last_synced_at": r.last_synced_at,
        }
        for r in rows
    ]


@router.get("/snapshot")
def snapshot(db: Session = Depends(get_db)):
    return build_snapshot(db)
