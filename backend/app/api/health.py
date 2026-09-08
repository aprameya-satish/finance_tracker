from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas.dtos import HealthOut
from app.services.plaid_service import plaid_configured

router = APIRouter()


@router.get("/health", response_model=HealthOut)
def health():
    settings = get_settings()
    return HealthOut(ok=True, plaid_configured=plaid_configured(), db=str(settings.db_path))
