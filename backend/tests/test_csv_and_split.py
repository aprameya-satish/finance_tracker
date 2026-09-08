from datetime import date
from pathlib import Path

from app.services.csv_import import detect_parser, parse_file
from app.services.merchant import normalize_merchant, parse_who
from app.services.money import cents_to_dollars, dollars_to_cents

FIXTURES = Path(__file__).parent / "fixtures"


def test_money_roundtrip():
    assert dollars_to_cents("12.95") == 1295
    assert dollars_to_cents(-9.99) == -999
    assert cents_to_dollars(1295) == 12.95


def test_merchant_normalize():
    assert normalize_merchant("AplPay WHOLEFDS ATL#ATLANTA             GA") == "WHOLEFDS ATL ATLANTA"
    assert parse_who("") == "shared"
    assert parse_who("A") == "A"


def test_chase_credit_parser():
    parser, rows = parse_file(FIXTURES / "Chase1561_Activity.csv")
    assert parser == "chase_credit"
    assert rows[0].amount_cents == 999
    assert rows[0].who == "shared"
    assert rows[2].who == "A"
    assert rows[2].amount_cents == 1800


def test_amex_parser():
    parser, rows = parse_file(FIXTURES / "Amex1004_Activity.csv")
    assert parser == "amex"
    assert rows[0].amount_cents == 11071
    assert rows[2].amount_cents == -1295


def test_chase_bank_parser():
    parser, rows = parse_file(FIXTURES / "Chase6009_Activity.csv")
    assert parser == "chase_bank"
    assert rows[0].txn_kind in {"spend", "payment"}
    assert rows[1].amount_cents == 240884


def test_utilities_parser():
    parser, rows = parse_file(FIXTURES / "2026_04_Home_Utilities.csv")
    assert parser == "utilities_manual"
    assert rows[0].who == "shared"


def test_import_and_who_edit(tmp_path, monkeypatch):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app.db.engine import Base
    from app.db import models  # noqa: F401
    from app.services.csv_import import persist_rows, parse_file
    from app.db.models import Transaction

    engine = create_engine(f"sqlite:///{tmp_path}/t.db")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    parser, rows = parse_file(FIXTURES / "Chase1561_Activity.csv")
    persist_rows(db, FIXTURES / "Chase1561_Activity.csv", parser, rows)
    db.commit()
    txn = db.query(Transaction).filter_by(who="A").one()
    txn.who = "S"
    txn.who_source = "user"
    db.commit()
    persist_rows(db, FIXTURES / "Chase1561_Activity.csv", parser, rows)
    db.commit()
    again = db.query(Transaction).filter_by(id=txn.id).one()
    assert again.who == "S"
    assert again.who_source == "user"
