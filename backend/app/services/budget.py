from collections import defaultdict
from datetime import date

from sqlalchemy.orm import Session

from app.db.models import Budget, Category, Transaction

SPEND_KINDS = ("spend", "refund")


def month_bounds(year_month: str) -> tuple[date, date]:
    y, m = [int(p) for p in year_month.split("-")]
    start = date(y, m, 1)
    end = date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)
    return start, end


def spend_query(db: Session, year_month: str, include_pending: bool = False):
    start, end = month_bounds(year_month)
    q = db.query(Transaction).filter(
        Transaction.date >= start,
        Transaction.date < end,
        Transaction.txn_kind.in_(SPEND_KINDS),
    )
    if not include_pending:
        q = q.filter(Transaction.pending.is_(False))
    return q


def category_spend_cents(db: Session, year_month: str, include_pending: bool = False) -> dict[int, int]:
    totals: dict[int, int] = defaultdict(int)
    for txn in spend_query(db, year_month, include_pending):
        if txn.category_id is None:
            continue
        cat = txn.category
        if cat and not cat.include_in_budget:
            continue
        totals[txn.category_id] += txn.amount_cents
    return dict(totals)


def budget_status(spent: int, limit_cents: int) -> str:
    if limit_cents <= 0:
        return "ok"
    pct = spent / limit_cents
    if pct > 1:
        return "over"
    if pct >= 0.8:
        return "watch"
    return "ok"


def month_budget_report(db: Session, year_month: str, include_pending: bool = False) -> list[dict]:
    spent_map = category_spend_cents(db, year_month, include_pending)
    budgets = db.query(Budget).filter_by(year_month=year_month).all()
    cats = {c.id: c for c in db.query(Category).all()}
    rows = []
    seen = set()
    for b in budgets:
        spent = spent_map.get(b.category_id, 0)
        cat = cats.get(b.category_id)
        status = budget_status(spent, b.limit_cents)
        rows.append(
            {
                "category_id": b.category_id,
                "category": cat.name if cat else "",
                "limit_cents": b.limit_cents,
                "spent_cents": spent,
                "delta_cents": b.limit_cents - spent,
                "pct": round(spent / b.limit_cents, 4) if b.limit_cents else None,
                "status": status,
            }
        )
        seen.add(b.category_id)
    for cat_id, spent in spent_map.items():
        if cat_id in seen:
            continue
        cat = cats.get(cat_id)
        rows.append(
            {
                "category_id": cat_id,
                "category": cat.name if cat else "",
                "limit_cents": 0,
                "spent_cents": spent,
                "delta_cents": -spent,
                "pct": None,
                "status": "unbudgeted",
            }
        )
    rows.sort(key=lambda r: (0 if r["status"] == "over" else 1 if r["status"] == "watch" else 2, r["category"]))
    return rows


def copy_budgets(db: Session, from_month: str, to_month: str) -> int:
    existing = {b.category_id for b in db.query(Budget).filter_by(year_month=to_month).all()}
    n = 0
    for b in db.query(Budget).filter_by(year_month=from_month).all():
        if b.category_id in existing:
            continue
        db.add(Budget(year_month=to_month, category_id=b.category_id, limit_cents=b.limit_cents))
        n += 1
    db.flush()
    return n
