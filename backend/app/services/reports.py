from collections import Counter, defaultdict
from datetime import timedelta

from sqlalchemy.orm import Session, joinedload

from app.db.models import Transaction
from app.services.budget import SPEND_KINDS, month_bounds, month_budget_report

REPORT_KINDS = SPEND_KINDS + ("investment_contribution",)
SERIES_TOP_N = 7


def _month_transactions(db: Session, year_month: str, include_pending: bool = False) -> list[Transaction]:
    start, end = month_bounds(year_month)
    q = (
        db.query(Transaction)
        .options(joinedload(Transaction.category))
        .filter(
            Transaction.date >= start,
            Transaction.date < end,
            Transaction.txn_kind.in_(REPORT_KINDS),
        )
    )
    if not include_pending:
        q = q.filter(Transaction.pending.is_(False))
    return q.all()


def _category_name(txn: Transaction) -> str:
    return txn.category.name if txn.category else "Uncategorized"


def split_totals(db: Session, year_month: str, include_pending: bool = False) -> dict:
    buckets = {"A": 0, "S": 0, "shared": 0}
    by_category: dict[str, dict[str, int]] = defaultdict(lambda: {"A": 0, "S": 0, "shared": 0, "total": 0})
    uncategorized = 0
    for txn in _month_transactions(db, year_month, include_pending):
        who = txn.who if txn.who in ("A", "S") else "shared"
        buckets[who] += txn.amount_cents
        name = _category_name(txn)
        by_category[name][who] += txn.amount_cents
        by_category[name]["total"] += txn.amount_cents
        if txn.category_id is None:
            uncategorized += txn.amount_cents
    a, s, shared = buckets["A"], buckets["S"], buckets["shared"]
    aprameya = a + shared // 2
    savanthi = s + (shared - shared // 2)
    cat_sum = sum(v["total"] for v in by_category.values())
    split_sum = a + s + shared
    return {
        "year_month": year_month,
        "a_cents": a,
        "s_cents": s,
        "shared_cents": shared,
        "aprameya_share_cents": aprameya,
        "savanthi_share_cents": savanthi,
        "total_cents": split_sum,
        "uncategorized_cents": uncategorized,
        "parity_delta_cents": cat_sum - split_sum,
        "categories": [
            {"category": k, **v} for k, v in sorted(by_category.items(), key=lambda kv: -kv[1]["total"])
        ],
        "budgets": month_budget_report(db, year_month, include_pending),
    }


def month_series(db: Session, year_month: str, include_pending: bool = False, top_n: int = SERIES_TOP_N) -> dict:
    start, end = month_bounds(year_month)
    txns = _month_transactions(db, year_month, include_pending)
    totals: Counter[str] = Counter()
    daily_cat: dict = defaultdict(lambda: defaultdict(int))
    for txn in txns:
        name = _category_name(txn)
        totals[name] += txn.amount_cents
        daily_cat[txn.date][name] += txn.amount_cents
    ranked = [name for name, _ in totals.most_common()]
    top = ranked[:top_n]
    rest = ranked[top_n:]
    labels = list(top) + (["Other"] if rest else [])
    days = []
    cursor = start
    while cursor < end:
        days.append(cursor)
        cursor += timedelta(days=1)
    daily_rows: list[dict] = []
    running = {lab: 0 for lab in labels}
    cumulative_rows: list[dict] = []
    for day in days:
        day_map = daily_cat.get(day, {})
        row: dict = {"date": day.isoformat(), "day": day.day, "total_cents": 0}
        for lab in top:
            cents = int(day_map.get(lab, 0))
            row[lab] = cents
            row["total_cents"] += cents
            running[lab] += cents
        if rest:
            other = sum(int(day_map.get(name, 0)) for name in rest)
            row["Other"] = other
            row["total_cents"] += other
            running["Other"] += other
        daily_rows.append(row)
        crow = {"date": day.isoformat(), "day": day.day, "total_cents": sum(running.values())}
        crow.update(running)
        cumulative_rows.append(crow)
    return {
        "year_month": year_month,
        "categories": labels,
        "daily": daily_rows,
        "cumulative": cumulative_rows,
    }
