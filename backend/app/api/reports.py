from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.engine import get_db
from app.db.models import Transaction
from app.services.pdf_report import build_month_pdf
from app.services.reports import month_series, split_totals

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/latest-month")
def latest_month(db: Session = Depends(get_db)):
    latest = db.query(Transaction).order_by(Transaction.date.desc()).first()
    if not latest:
        from datetime import date

        return {"year_month": date.today().strftime("%Y-%m")}
    return {"year_month": latest.date.strftime("%Y-%m")}


@router.get("/month/{year_month}/series")
def month_series_api(year_month: str, include_pending: bool = False, db: Session = Depends(get_db)):
    return month_series(db, year_month, include_pending)


@router.get("/month/{year_month}/pdf")
def month_pdf(year_month: str, include_pending: bool = False, db: Session = Depends(get_db)):
    payload = build_month_pdf(db, year_month, include_pending)
    filename = f"finance-report-{year_month}.pdf"
    return Response(
        content=payload,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/month/{year_month}")
def month_report(year_month: str, include_pending: bool = False, db: Session = Depends(get_db)):
    return split_totals(db, year_month, include_pending)
