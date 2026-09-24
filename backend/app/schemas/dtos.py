from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class HealthOut(BaseModel):
    ok: bool
    plaid_configured: bool
    db: str


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    include_in_budget: bool
    is_archived: bool


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    include_in_budget: Optional[bool] = None
    is_archived: Optional[bool] = None


class CategoryCreate(BaseModel):
    name: str
    include_in_budget: bool = True


class AccountOut(BaseModel):
    id: int
    name: str
    last4: Optional[str]
    kind: str
    institution: str
    is_active: bool
    plaid_item_id: Optional[int] = None


class TransactionOut(BaseModel):
    id: int
    date: date
    description: str
    merchant_norm: str
    amount_cents: int
    txn_kind: str
    pending: bool
    who: str
    who_source: str
    category_id: Optional[int]
    category: Optional[str]
    category_source: Optional[str]
    category_confidence: Optional[float]
    notes: Optional[str]
    account_id: int
    account_name: str
    source: str


class TransactionPatch(BaseModel):
    who: Optional[str] = None
    category_id: Optional[int] = None
    notes: Optional[str] = None
    txn_kind: Optional[str] = None
    update_merchant_rule: bool = False


class BulkWhoIn(BaseModel):
    ids: list[int]
    who: str
    update_merchant_rule: bool = False


class ImportDirectoryIn(BaseModel):
    directory: Optional[str] = None


class ImportResultOut(BaseModel):
    files: int
    rows_ok: int
    rows_skipped: int
    errors: list[str]


class BudgetIn(BaseModel):
    year_month: str
    category_id: int
    limit_cents: int


class BudgetCopyIn(BaseModel):
    from_month: str
    to_month: str


class LinkTokenOut(BaseModel):
    link_token: str


class LinkTokenIn(BaseModel):
    redirect_uri: Optional[str] = None


class PublicTokenIn(BaseModel):
    public_token: str


class SettingsOut(BaseModel):
    person_a: str
    person_s: str
    csv_import_directory: str
    plaid_configured: bool
    plaid_env: str
    plaid_products: list[str]


class SettingsIn(BaseModel):
    person_a: Optional[str] = None
    person_s: Optional[str] = None
    csv_import_directory: Optional[str] = None


class InvestmentSummaryOut(BaseModel):
    as_of: Optional[datetime] = None
    value_cents: int = 0
    holdings: list = Field(default_factory=list)
