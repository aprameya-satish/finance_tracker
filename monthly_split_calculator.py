"""CLI wrapper: import a CSV directory and print the monthly split report."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "backend"))

from app.db.engine import SessionLocal, init_db  # noqa: E402
from app.services.csv_import import import_directory  # noqa: E402
from app.services.money import cents_to_dollars  # noqa: E402
from app.services.reports import split_totals  # noqa: E402


def get_parsed_args():
    parser = argparse.ArgumentParser(description="Compute monthly expenses split")
    parser.add_argument("--csv_directory", metavar="fpath", type=str, nargs=1, help="Directory of monthly CSVs")
    parser.add_argument("-d", "--debug_mode", action="store_true")
    parser.add_argument("--month", type=str, help="YYYY-MM (defaults to latest transaction month)")
    return parser.parse_args()


def main() -> None:
    args = get_parsed_args()
    init_db()
    db = SessionLocal()
    try:
        if args.debug_mode:
            directory = str(ROOT / "backend" / "tests" / "fixtures")
        else:
            if not args.csv_directory:
                raise SystemExit("Provide --csv_directory or --debug_mode")
            directory = args.csv_directory[0]
        result = import_directory(db, directory)
        print(
            json.dumps(
                {
                    "imported_files": result.files,
                    "rows_ok": result.rows_ok,
                    "rows_skipped": result.rows_skipped,
                    "errors": result.errors,
                },
                indent=2,
            )
        )
        month = args.month
        if not month:
            from app.db.models import Transaction

            latest = db.query(Transaction).order_by(Transaction.date.desc()).first()
            month = latest.date.strftime("%Y-%m") if latest else date.today().strftime("%Y-%m")
        report = split_totals(db, month)
        printable = {
            "month": month,
            "split": {
                "Aprameya": cents_to_dollars(report["aprameya_share_cents"]),
                "Savanthi": cents_to_dollars(report["savanthi_share_cents"]),
                "A_subtotal": cents_to_dollars(report["a_cents"]),
                "S_subtotal": cents_to_dollars(report["s_cents"]),
                "both_subtotal": cents_to_dollars(report["shared_cents"]),
            },
            "category_totals": {
                row["category"]: cents_to_dollars(row["total"]) for row in report["categories"]
            },
            "parity_delta": cents_to_dollars(report["parity_delta_cents"]),
        }
        print(json.dumps(printable, indent=2))
        if report["parity_delta_cents"] == 0:
            print("SUCCESS - Confirmed parity between category totals and split totals.")
        else:
            print(f"WARNING - parity delta {printable['parity_delta']} USD")
    finally:
        db.close()


if __name__ == "__main__":
    main()
