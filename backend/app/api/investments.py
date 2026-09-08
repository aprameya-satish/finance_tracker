from fastapi import APIRouter, HTTPException

from app.schemas.dtos import InvestmentSummaryOut

router = APIRouter(prefix="/investments", tags=["investments"])


@router.get("/summary", response_model=InvestmentSummaryOut)
def summary():
    return InvestmentSummaryOut(as_of=None, value_cents=0, holdings=[])


@router.get("/holdings")
def holdings():
    return []


@router.post("/sync")
def sync():
    raise HTTPException(501, "Plaid Investments not enabled")
