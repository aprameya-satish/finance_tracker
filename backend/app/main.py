from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import accounts, budgets, categories, health, imports, investments, plaid, reports, settings as settings_api, transactions
from app.core.config import get_settings
from app.db.engine import SessionLocal, init_db

app = FastAPI(title="Finance Tracker", version="0.1.0")
app_settings = get_settings()
_origins = app_settings.cors_origin_list or [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
_allow_all = "*" in _origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _allow_all else _origins,
    allow_credentials=not _allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(accounts.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(imports.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(budgets.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(plaid.router, prefix="/api")
app.include_router(investments.router, prefix="/api")
app.include_router(settings_api.router, prefix="/api")


def _seed_fixtures_if_empty() -> None:
    from app.core.config import ROOT_DIR
    from app.db.models import Transaction
    from app.services.csv_import import import_directory

    db = SessionLocal()
    try:
        if db.query(Transaction).count() == 0:
            fixtures = ROOT_DIR / "backend" / "tests" / "fixtures"
            if fixtures.is_dir():
                import_directory(db, fixtures)
    except Exception:
        db.rollback()
    finally:
        db.close()


@app.on_event("startup")
def on_startup():
    init_db()
    _seed_fixtures_if_empty()
    hours = app_settings.plaid_sync_interval_hours
    if hours and hours > 0:
        try:
            from apscheduler.schedulers.background import BackgroundScheduler
            from app.services.plaid_service import plaid_configured, sync_all

            if plaid_configured():
                scheduler = BackgroundScheduler()

                def _job():
                    db = SessionLocal()
                    try:
                        sync_all(db)
                    finally:
                        db.close()

                scheduler.add_job(_job, "interval", hours=hours, id="plaid-sync")
                scheduler.start()
                app.state.scheduler = scheduler
        except Exception:
            pass
