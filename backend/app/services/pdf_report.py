from __future__ import annotations

import io
from datetime import datetime

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from sqlalchemy.orm import Session

from app.db.models import AppSetting
from app.services.money import cents_to_dollars
from app.services.reports import month_series, split_totals

PALETTE = [
    "#1B7F3A",
    "#2F6FED",
    "#C48A00",
    "#C43D44",
    "#7C3AED",
    "#0F766E",
    "#C2410C",
    "#64748B",
]


def _people(db: Session) -> tuple[str, str]:
    names = {"person_a": "Aprameya", "person_s": "Savanthi"}
    for key in names:
        row = db.query(AppSetting).filter_by(key=key).one_or_none()
        if row and row.value.strip():
            names[key] = row.value.strip()
    return names["person_a"], names["person_s"]


def _usd(cents: int) -> str:
    return f"${cents_to_dollars(cents):,.2f}"


def _style(ax) -> None:
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.tick_params(colors="#334155", labelsize=8)
    ax.yaxis.label.set_color("#334155")
    ax.xaxis.label.set_color("#334155")
    ax.set_facecolor("white")


def build_month_pdf(db: Session, year_month: str, include_pending: bool = False) -> bytes:
    report = split_totals(db, year_month, include_pending)
    series = month_series(db, year_month, include_pending)
    person_a, person_s = _people(db)
    buf = io.BytesIO()
    with PdfPages(buf) as pdf:
        _page_summary(pdf, report, person_a, person_s, year_month)
        _page_category_bars(pdf, report, year_month)
        _page_evolution(pdf, series, year_month)
    return buf.getvalue()


def _page_summary(pdf: PdfPages, report: dict, person_a: str, person_s: str, year_month: str) -> None:
    fig = plt.figure(figsize=(8.5, 11), facecolor="white")
    fig.text(0.08, 0.94, "Monthly spending report", fontsize=18, weight="medium", color="#0B0D0C")
    fig.text(0.08, 0.905, year_month, fontsize=11, color="#64748B")

    split_rows = [
        ["A subtotal", _usd(report["a_cents"])],
        ["S subtotal", _usd(report["s_cents"])],
        ["Shared", _usd(report["shared_cents"])],
        [f"{person_a} share (A + half shared)", _usd(report["aprameya_share_cents"])],
        [f"{person_s} share (S + half shared)", _usd(report["savanthi_share_cents"])],
        ["Month total", _usd(report["total_cents"])],
        ["Uncategorized", _usd(report["uncategorized_cents"])],
        ["Parity delta", _usd(report["parity_delta_cents"])],
    ]
    ax1 = fig.add_axes([0.08, 0.68, 0.84, 0.18])
    ax1.axis("off")
    ax1.set_title("Household split", loc="left", fontsize=11, color="#0B0D0C", pad=8)
    table1 = ax1.table(cellText=split_rows, colWidths=[0.72, 0.28], loc="upper left", cellLoc="left")
    table1.auto_set_font_size(False)
    table1.set_fontsize(9)
    table1.scale(1, 1.45)
    for (row, col), cell in table1.get_celld().items():
        cell.set_edgecolor("#E2E8F0")
        cell.set_facecolor("#F8FAFC" if row % 2 == 0 else "white")
        if col == 1:
            cell.get_text().set_ha("right")

    cats = report["categories"]
    cat_rows = [
        [
            row["category"],
            _usd(row["A"]),
            _usd(row["S"]),
            _usd(row["shared"]),
            _usd(row["total"]),
            f"{(row['total'] / report['total_cents'] * 100):.1f}%" if report["total_cents"] else "—",
        ]
        for row in cats
    ]
    ax2 = fig.add_axes([0.08, 0.08, 0.84, 0.54])
    ax2.axis("off")
    ax2.set_title("Categorical spend", loc="left", fontsize=11, color="#0B0D0C", pad=8)
    if cat_rows:
        table2 = ax2.table(
            cellText=cat_rows,
            colLabels=["Category", "A", "S", "Shared", "Total", "Share"],
            loc="upper left",
            cellLoc="right",
        )
        table2.auto_set_font_size(False)
        table2.set_fontsize(8)
        table2.scale(1, 1.35)
        for (row, col), cell in table2.get_celld().items():
            cell.set_edgecolor("#E2E8F0")
            if row == 0:
                cell.set_facecolor("#0B0D0C")
                cell.set_text_props(color="white")
                cell.get_text().set_ha("left" if col == 0 else "right")
            else:
                cell.set_facecolor("#F8FAFC" if row % 2 == 0 else "white")
                if col == 0:
                    cell.get_text().set_ha("left")
    else:
        ax2.text(0, 0.9, "No spend this month.", color="#64748B")
    fig.text(0.08, 0.03, f"Generated {datetime.now().strftime('%Y-%m-%d %H:%M')}", fontsize=8, color="#94A3B8")
    pdf.savefig(fig)
    plt.close(fig)


def _page_category_bars(pdf: PdfPages, report: dict, year_month: str) -> None:
    fig, ax = plt.subplots(figsize=(8.5, 11), facecolor="white")
    cats = list(reversed(report["categories"]))
    labels = [row["category"] for row in cats]
    values = [cents_to_dollars(row["total"]) for row in cats]
    colors = [PALETTE[i % len(PALETTE)] for i in range(len(labels))]
    ax.barh(labels, values, color=colors, height=0.62)
    ax.set_xlabel("USD")
    ax.set_title(f"Total spend by category  ·  {year_month}", loc="left", fontsize=13, color="#0B0D0C")
    _style(ax)
    fig.tight_layout(rect=(0.06, 0.04, 0.96, 0.96))
    pdf.savefig(fig)
    plt.close(fig)


def _page_evolution(pdf: PdfPages, series: dict, year_month: str) -> None:
    fig, ax = plt.subplots(figsize=(8.5, 11), facecolor="white")
    labels = series["categories"]
    days = [row["day"] for row in series["cumulative"]]
    if labels and days:
        stacks = [[cents_to_dollars(row.get(lab, 0)) for row in series["cumulative"]] for lab in labels]
        ax.stackplot(days, stacks, labels=labels, colors=[PALETTE[i % len(PALETTE)] for i in range(len(labels))], alpha=0.92)
        ax.legend(loc="upper left", frameon=False, fontsize=8)
    ax.set_xlabel("Day of month")
    ax.set_ylabel("Cumulative USD")
    ax.set_title(f"Category spend over the month  ·  {year_month}", loc="left", fontsize=13, color="#0B0D0C")
    _style(ax)
    fig.tight_layout(rect=(0.06, 0.04, 0.96, 0.96))
    pdf.savefig(fig)
    plt.close(fig)
