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


def test_sanitize_upload_name():
    from app.services.csv_import import sanitize_upload_name

    assert sanitize_upload_name("C:/tmp/Chase1561_Activity.csv") == "Chase1561_Activity.csv"
    try:
        sanitize_upload_name("notes.txt")
        raise AssertionError("expected rejection")
    except ValueError:
        pass


def test_import_uploads(tmp_path):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app.db.engine import Base
    from app.db import models  # noqa: F401
    from app.db.models import Transaction
    from app.services.csv_import import import_uploads

    engine = create_engine(f"sqlite:///{tmp_path}/u.db")
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    payload = (FIXTURES / "Chase1561_Activity.csv").read_bytes()
    result = import_uploads(db, [("Chase1561_Activity.csv", payload)])
    assert result.files == 1
    assert result.rows_ok == 3
    assert db.query(Transaction).count() == 3


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


def test_apply_prediction_preserves_user_labels():
    from types import SimpleNamespace

    from app.services.categorizer import apply_prediction

    txn = SimpleNamespace(
        who="A",
        who_source="user",
        category_id=1,
        category_source="user",
        category_confidence=1.0,
    )
    apply_prediction(
        txn,
        {"category_id": 99, "who": "S", "confidence": 0.9, "source": "rule"},
    )
    assert txn.who == "A"
    assert txn.category_id == 1
    assert txn.category_source == "user"


def test_note_user_correction_retrains_after_n(tmp_path, monkeypatch):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app.db.engine import Base
    from app.db import models  # noqa: F401
    from app.db.models import AppSetting
    from app.services import categorizer

    monkeypatch.setattr(categorizer, "RETRAIN_EVERY", 2)
    called = {"n": 0}

    def fake_train(db):
        called["n"] += 1
        return {"trained": True}

    monkeypatch.setattr(categorizer, "train_models", fake_train)
    engine = create_engine(f"sqlite:///{tmp_path}/retrain.db")
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    assert categorizer.note_user_correction(db) is None
    assert db.query(AppSetting).filter_by(key=categorizer.CORRECTION_KEY).one().value == "1"
    info = categorizer.note_user_correction(db)
    assert info == {"trained": True}
    assert called["n"] == 1
    assert db.query(AppSetting).filter_by(key=categorizer.CORRECTION_KEY).one().value == "0"


def test_budget_status_and_copy(tmp_path):
    from datetime import date

    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app.db.engine import Base
    from app.db import models  # noqa: F401
    from app.db.models import Account, Budget, Category, Institution, Transaction
    from app.services.budget import budget_status, copy_budgets, month_budget_report

    engine = create_engine(f"sqlite:///{tmp_path}/b.db")
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    assert budget_status(79, 100) == "ok"
    assert budget_status(80, 100) == "watch"
    assert budget_status(101, 100) == "over"

    inst = Institution(name="Chase")
    db.add(inst)
    db.flush()
    acct = Account(institution_id=inst.id, name="Chase 1561", last4="1561", kind="credit")
    cat = Category(name="Groceries", include_in_budget=True)
    db.add_all([acct, cat])
    db.flush()
    db.add(Budget(year_month="2026-03", category_id=cat.id, limit_cents=5000))
    db.add(
        Transaction(
            account_id=acct.id,
            source="csv",
            external_id="t1",
            date=date(2026, 4, 2),
            description_raw="STORE",
            merchant_norm="STORE",
            amount_cents=6000,
            txn_kind="spend",
            category_id=cat.id,
            who="shared",
        )
    )
    copied = copy_budgets(db, "2026-03", "2026-04")
    db.commit()
    assert copied == 1
    rows = month_budget_report(db, "2026-04")
    groceries = next(r for r in rows if r["category"] == "Groceries")
    assert groceries["status"] == "over"
    assert groceries["spent_cents"] == 6000
