from __future__ import annotations

import re
import shutil
import tempfile
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Iterable, Optional

import pandas as pd
from sqlalchemy.orm import Session

from app.db.models import Account, Category, ImportBatch, Institution, Transaction
from app.services.merchant import csv_fingerprint, normalize_merchant, parse_who
from app.services.money import dollars_to_cents

NO_BUDGET_NAMES = {"investments", "transfer", "payment", "credit card payment"}
INVESTMENT_HINTS = ("ROBINHOOD", "FIDELITY", "VANGUARD", "SCHWAB", "COINBASE", "WEALTHFRONT")

FILENAME_LAST4 = re.compile(r"(chase|amex)(\d{4})", re.I)


@dataclass
class ParsedRow:
    txn_date: date
    description: str
    amount_cents: int
    category_name: Optional[str]
    who: str
    notes: Optional[str]
    txn_kind: str
    last4: Optional[str]
    institution_name: str
    account_kind: str
    account_name: str


@dataclass
class ImportResult:
    files: int = 0
    rows_ok: int = 0
    rows_skipped: int = 0
    errors: list[str] = field(default_factory=list)


def _parse_date(value) -> date:
    ts = pd.to_datetime(value, errors="coerce")
    if pd.isna(ts):
        raise ValueError(f"unreadable date: {value}")
    return ts.date()


def _read_csv(path: Path) -> pd.DataFrame:
    last_err = None
    for enc in ("utf-8-sig", "utf-8", "cp1252"):
        try:
            return pd.read_csv(path, encoding=enc)
        except Exception as exc:  # noqa: BLE001
            last_err = exc
    raise ValueError(f"could not read {path}: {last_err}")


def detect_parser(path: Path, columns: Iterable[str]) -> str:
    cols = {str(c).strip() for c in columns}
    name = path.name.lower()
    if "home_utilities" in name:
        return "utilities_manual"
    if "Card Member" in cols or "Account #" in cols:
        return "amex"
    if "Details" in cols and "Balance" in cols:
        return "chase_bank"
    if "Transaction Date" in cols:
        return "chase_credit"
    raise ValueError(f"unknown CSV schema for {path.name}: {sorted(cols)}")


def _last4_from_name(path: Path) -> Optional[str]:
    m = FILENAME_LAST4.search(path.name)
    return m.group(2) if m else None


def _institution_from_name(path: Path, parser: str) -> str:
    m = FILENAME_LAST4.search(path.name)
    if m:
        return m.group(1).title()
    if parser == "utilities_manual":
        return "Manual"
    return "Unknown"


def _account_kind(parser: str) -> str:
    if parser == "chase_credit":
        return "credit"
    if parser == "amex":
        return "credit"
    if parser == "chase_bank":
        return "depository"
    return "manual"


def infer_txn_kind(description: str, category_name: Optional[str], amount_cents: int, type_value: str | None) -> str:
    desc = (description or "").upper()
    typ = (type_value or "").upper()
    cat = (category_name or "").strip().lower()
    if cat == "investments" or any(h in desc for h in INVESTMENT_HINTS):
        return "investment_contribution"
    if typ in {"PAYMENT", "ACCT_XFER", "TRANSFER"} or "AUTOPAY PAYMENT" in desc or "PAYMENT THANK YOU" in desc:
        return "payment"
    if typ in {"RETURN", "REFUND", "CREDIT"}:
        return "refund"
    if amount_cents < 0:
        return "refund"
    return "spend"


def parse_chase_credit(path: Path, df: pd.DataFrame) -> list[ParsedRow]:
    last4 = _last4_from_name(path)
    inst = _institution_from_name(path, "chase_credit")
    rows: list[ParsedRow] = []
    for _, r in df.iterrows():
        raw_amt = r.get("Amount")
        # Chase expenses are negative; invert to positive = money out.
        cents = -dollars_to_cents(raw_amt)
        desc = str(r.get("Description") or "").strip()
        cat = _opt_str(r.get("Category"))
        who = parse_who(r.get("Who"))
        notes = _opt_str(r.get("Notes") or r.get("Note"))
        typ = _opt_str(r.get("Type"))
        rows.append(
            ParsedRow(
                txn_date=_parse_date(r.get("Transaction Date") or r.get("Post Date")),
                description=desc,
                amount_cents=cents,
                category_name=cat,
                who=who,
                notes=notes,
                txn_kind=infer_txn_kind(desc, cat, cents, typ),
                last4=last4,
                institution_name=inst,
                account_kind="credit",
                account_name=f"{inst} {last4 or 'card'}",
            )
        )
    return rows


def parse_chase_bank(path: Path, df: pd.DataFrame) -> list[ParsedRow]:
    last4 = _last4_from_name(path)
    inst = _institution_from_name(path, "chase_bank")
    rows: list[ParsedRow] = []
    for _, r in df.iterrows():
        raw_amt = r.get("Amount")
        cents = -dollars_to_cents(raw_amt)
        desc = str(r.get("Description") or "").strip()
        cat = _opt_str(r.get("Category"))
        who = parse_who(r.get("Who"))
        typ = _opt_str(r.get("Type"))
        rows.append(
            ParsedRow(
                txn_date=_parse_date(r.get("Posting Date") or r.get("Date")),
                description=desc,
                amount_cents=cents,
                category_name=cat,
                who=who,
                notes=None,
                txn_kind=infer_txn_kind(desc, cat, cents, typ),
                last4=last4,
                institution_name=inst,
                account_kind="depository",
                account_name=f"{inst} checking {last4 or ''}".strip(),
            )
        )
    return rows


def parse_amex(path: Path, df: pd.DataFrame) -> list[ParsedRow]:
    last4 = _last4_from_name(path)
    inst = "Amex"
    rows: list[ParsedRow] = []
    for _, r in df.iterrows():
        cents = dollars_to_cents(r.get("Amount"))
        desc = str(r.get("Description") or "").strip()
        cat = _opt_str(r.get("Category"))
        who = parse_who(r.get("Who"))
        acct = str(r.get("Account #") or "")
        if not last4:
            digits = re.sub(r"\D", "", acct)
            last4 = digits[-4:] if digits else None
        rows.append(
            ParsedRow(
                txn_date=_parse_date(r.get("Date")),
                description=desc,
                amount_cents=cents,
                category_name=cat,
                who=who,
                notes=None,
                txn_kind=infer_txn_kind(desc, cat, cents, None),
                last4=last4,
                institution_name=inst,
                account_kind="credit",
                account_name=f"Amex {last4 or 'card'}",
            )
        )
    return rows


def parse_utilities(path: Path, df: pd.DataFrame) -> list[ParsedRow]:
    rows: list[ParsedRow] = []
    for _, r in df.iterrows():
        raw_amt = r.get("Amount")
        cents = -dollars_to_cents(raw_amt)
        desc = str(r.get("Description") or "").strip()
        cat = _opt_str(r.get("Category"))
        who = parse_who(r.get("Who"))
        notes = _opt_str(r.get("Note") or r.get("Notes"))
        rows.append(
            ParsedRow(
                txn_date=_parse_date(r.get("Date")),
                description=desc,
                amount_cents=cents,
                category_name=cat,
                who=who,
                notes=notes,
                txn_kind=infer_txn_kind(desc, cat, cents, None),
                last4=None,
                institution_name="Manual",
                account_kind="manual",
                account_name="Home utilities",
            )
        )
    return rows


PARSERS = {
    "chase_credit": parse_chase_credit,
    "chase_bank": parse_chase_bank,
    "amex": parse_amex,
    "utilities_manual": parse_utilities,
}


def _opt_str(value) -> Optional[str]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip()
    return text or None


def parse_file(path: Path) -> tuple[str, list[ParsedRow]]:
    df = _read_csv(path)
    df.columns = [str(c).strip() for c in df.columns]
    parser = detect_parser(path, df.columns)
    rows = PARSERS[parser](path, df)
    return parser, rows


def get_or_create_institution(db: Session, name: str) -> Institution:
    inst = db.query(Institution).filter_by(name=name).one_or_none()
    if inst:
        return inst
    inst = Institution(name=name)
    db.add(inst)
    db.flush()
    return inst


def get_or_create_account(db: Session, row: ParsedRow) -> Account:
    inst = get_or_create_institution(db, row.institution_name)
    q = db.query(Account).filter_by(institution_id=inst.id, last4=row.last4, kind=row.account_kind)
    acct = q.one_or_none()
    if acct:
        return acct
    acct = Account(
        institution_id=inst.id,
        name=row.account_name,
        last4=row.last4,
        kind=row.account_kind,
    )
    db.add(acct)
    db.flush()
    return acct


def get_or_create_category(db: Session, name: str) -> Category:
    existing = db.query(Category).filter(Category.name == name).one_or_none()
    if existing:
        return existing
    cat = Category(
        name=name,
        include_in_budget=name.strip().lower() not in NO_BUDGET_NAMES,
    )
    db.add(cat)
    db.flush()
    return cat


def persist_rows(db: Session, path: Path, parser: str, rows: list[ParsedRow]) -> ImportBatch:
    batch = ImportBatch(path=str(path), parser=parser, errors=[])
    db.add(batch)
    db.flush()
    ok = 0
    skipped = 0
    errors: list[str] = []
    for row in rows:
        try:
            account = get_or_create_account(db, row)
            external_id = csv_fingerprint(row.last4, row.txn_date, row.amount_cents, row.description)
            existing = (
                db.query(Transaction)
                .filter_by(account_id=account.id, external_id=external_id)
                .one_or_none()
            )
            category = get_or_create_category(db, row.category_name) if row.category_name else None
            if existing:
                if existing.who_source != "user":
                    existing.who = row.who
                    existing.who_source = "imported"
                if existing.category_source != "user" and category:
                    existing.category_id = category.id
                    existing.category_source = "imported"
                    existing.category_confidence = 1.0
                existing.amount_cents = row.amount_cents
                existing.date = row.txn_date
                existing.description_raw = row.description
                existing.merchant_norm = normalize_merchant(row.description)
                existing.txn_kind = row.txn_kind
                existing.notes = row.notes if row.notes else existing.notes
                skipped += 1
                continue
            txn = Transaction(
                account_id=account.id,
                source="csv",
                external_id=external_id,
                date=row.txn_date,
                description_raw=row.description,
                merchant_norm=normalize_merchant(row.description),
                amount_cents=row.amount_cents,
                txn_kind=row.txn_kind,
                pending=False,
                category_id=category.id if category else None,
                who=row.who,
                who_source="imported",
                category_source="imported" if category else None,
                category_confidence=1.0 if category else None,
                notes=row.notes,
                import_batch_id=batch.id,
            )
            db.add(txn)
            ok += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{path.name}: {exc}")
    batch.rows_ok = ok
    batch.rows_skipped = skipped
    batch.errors = errors or None
    return batch


def collect_csv_files(directory: Path) -> list[Path]:
    files: list[Path] = []
    for p in sorted(directory.rglob("*")):
        if p.is_file() and p.suffix.lower() == ".csv":
            files.append(p)
    return files


def sanitize_upload_name(name: str) -> str:
    base = Path(name or "").name.strip()
    if not base.lower().endswith(".csv"):
        raise ValueError("only .csv files are accepted")
    cleaned = re.sub(r"[^\w.\- ]+", "_", base).strip()
    if not cleaned.lower().endswith(".csv"):
        raise ValueError("only .csv files are accepted")
    return cleaned[:180]


def import_paths(db: Session, paths: Iterable[Path]) -> ImportResult:
    from app.services.categorizer import rebuild_merchant_rules, train_models

    result = ImportResult()
    for path in paths:
        result.files += 1
        try:
            parser, rows = parse_file(path)
            batch = persist_rows(db, path, parser, rows)
            result.rows_ok += batch.rows_ok
            result.rows_skipped += batch.rows_skipped
            if batch.errors:
                result.errors.extend(batch.errors)
        except Exception as exc:  # noqa: BLE001
            result.errors.append(f"{path.name}: {exc}")
    rebuild_merchant_rules(db)
    train_models(db)
    db.commit()
    return result


def import_directory(db: Session, directory: str | Path) -> ImportResult:
    root = Path(directory)
    if not root.is_dir():
        raise FileNotFoundError(str(root))
    return import_paths(db, collect_csv_files(root))


def import_uploads(db: Session, uploads: list[tuple[str, bytes]]) -> ImportResult:
    if not uploads:
        raise ValueError("no files uploaded")
    tmp = Path(tempfile.mkdtemp(prefix="ft-csv-"))
    try:
        paths: list[Path] = []
        errors: list[str] = []
        for name, data in uploads:
            try:
                safe = sanitize_upload_name(name)
                dest = tmp / safe
                dest.write_bytes(data)
                paths.append(dest)
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{name}: {exc}")
        result = import_paths(db, paths) if paths else ImportResult()
        result.errors = errors + result.errors
        return result
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
