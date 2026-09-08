from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.engine import Base


class Institution(Base):
    __tablename__ = "institutions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)

    accounts: Mapped[list["Account"]] = relationship(back_populates="institution")


class PlaidItem(Base):
    __tablename__ = "plaid_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[str] = mapped_column(String(128), unique=True)
    access_token_encrypted: Mapped[str] = mapped_column(Text)
    sync_cursor: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active")
    products: Mapped[list] = mapped_column(JSON, default=list)
    institution_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    accounts: Mapped[list["Account"]] = relationship(back_populates="plaid_item")


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    institution_id: Mapped[int] = mapped_column(ForeignKey("institutions.id"))
    name: Mapped[str] = mapped_column(String(120))
    last4: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    kind: Mapped[str] = mapped_column(String(32))  # credit | depository | manual | brokerage
    plaid_account_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, unique=True)
    plaid_item_id: Mapped[Optional[int]] = mapped_column(ForeignKey("plaid_items.id"), nullable=True)
    mask: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    official_name: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    institution: Mapped[Institution] = relationship(back_populates="accounts")
    plaid_item: Mapped[Optional[PlaidItem]] = relationship(back_populates="accounts")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="account")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    include_in_budget: Mapped[bool] = mapped_column(Boolean, default=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="category")
    budgets: Mapped[list["Budget"]] = relationship(back_populates="category")


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (UniqueConstraint("account_id", "external_id", name="uq_txn_account_external"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"))
    source: Mapped[str] = mapped_column(String(16))  # plaid | csv | manual
    external_id: Mapped[str] = mapped_column(String(128))
    date: Mapped[date] = mapped_column(Date)
    description_raw: Mapped[str] = mapped_column(String(512))
    merchant_norm: Mapped[str] = mapped_column(String(256), default="")
    amount_cents: Mapped[int] = mapped_column(Integer)  # positive = money out
    txn_kind: Mapped[str] = mapped_column(String(32), default="spend")
    pending: Mapped[bool] = mapped_column(Boolean, default=False)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"), nullable=True)
    who: Mapped[str] = mapped_column(String(16), default="shared")  # A | S | shared
    who_source: Mapped[str] = mapped_column(String(16), default="imported")
    category_source: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    category_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    plaid_pfc_primary: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    import_batch_id: Mapped[Optional[int]] = mapped_column(ForeignKey("import_batches.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    account: Mapped[Account] = relationship(back_populates="transactions")
    category: Mapped[Optional[Category]] = relationship(back_populates="transactions")


class MerchantRule(Base):
    __tablename__ = "merchant_rules"
    __table_args__ = (UniqueConstraint("merchant_norm", name="uq_merchant_norm"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    merchant_norm: Mapped[str] = mapped_column(String(256))
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"), nullable=True)
    who: Mapped[str] = mapped_column(String(16), default="shared")
    hit_count: Mapped[int] = mapped_column(Integer, default=1)
    last_used: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Budget(Base):
    __tablename__ = "budgets"
    __table_args__ = (UniqueConstraint("year_month", "category_id", name="uq_budget_month_cat"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    year_month: Mapped[str] = mapped_column(String(7))  # YYYY-MM
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    limit_cents: Mapped[int] = mapped_column(Integer)

    category: Mapped[Category] = relationship(back_populates="budgets")


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    path: Mapped[str] = mapped_column(Text)
    parser: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    rows_ok: Mapped[int] = mapped_column(Integer, default=0)
    rows_skipped: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")


class Security(Base):
    __tablename__ = "securities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plaid_security_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, unique=True)
    ticker: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    name: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    cusip: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)


class Holding(Base):
    __tablename__ = "holdings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"))
    security_id: Mapped[int] = mapped_column(ForeignKey("securities.id"))
    quantity: Mapped[float] = mapped_column(Float, default=0)
    cost_basis_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    value_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    as_of: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class InvestmentTransaction(Base):
    __tablename__ = "investment_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"))
    security_id: Mapped[Optional[int]] = mapped_column(ForeignKey("securities.id"), nullable=True)
    plaid_investment_transaction_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, unique=True)
    date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    subtype: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    qty: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    price_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    amount_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    name: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
