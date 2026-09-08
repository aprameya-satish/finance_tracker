from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.engine import Base
from app.db import models  # noqa: F401
from app.services.csv_import import persist_rows, parse_file
from app.services.pdf_report import build_month_pdf
from app.services.reports import month_series, split_totals

FIXTURES = Path(__file__).parent / "fixtures"


def _db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path}/t.db")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    for name in [
        "Chase1561_Activity.csv",
        "Amex1004_Activity.csv",
        "Chase6009_Activity.csv",
        "2026_04_Home_Utilities.csv",
    ]:
        path = FIXTURES / name
        parser, rows = parse_file(path)
        persist_rows(db, path, parser, rows)
    db.commit()
    return db


def test_month_series_covers_april_and_matches_totals(tmp_path):
    db = _db(tmp_path)
    report = split_totals(db, "2026-04")
    series = month_series(db, "2026-04")
    assert series["categories"]
    assert len(series["daily"]) == 30
    assert series["daily"][0]["day"] == 1
    last_cum = series["cumulative"][-1]["total_cents"]
    assert last_cum == report["total_cents"]


def test_month_pdf_is_pdf(tmp_path):
    db = _db(tmp_path)
    payload = build_month_pdf(db, "2026-04")
    assert payload.startswith(b"%PDF")
    assert len(payload) > 1000
