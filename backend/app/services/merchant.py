import re

_PREFIXES = (
    r"APLPAY\s+",
    r"APL PAY\s+",
    r"APPLE PAY\s+",
    r"SQ\s*\*?\s*",
    r"TST\s*\*\s*",
    r"SP\s+",
    r"PAYPAL\s*\*",
)
_CITY_STATE = re.compile(r"\s+[A-Z][A-Z]+\s+[A-Z]{2}$")
_TRAILING_STATE = re.compile(r"\s+[A-Z]{2}$")
_STORE_NUM = re.compile(r"\s+#?\d{3,}$")
_NON_ALNUM = re.compile(r"[^A-Z0-9 &]+")
_SPACES = re.compile(r"\s+")


def normalize_merchant(raw: str | None) -> str:
    if not raw:
        return ""
    s = str(raw).upper().strip()
    for pat in _PREFIXES:
        s = re.sub(pat, "", s)
    s = _CITY_STATE.sub("", s)
    s = _TRAILING_STATE.sub("", s)
    s = re.sub(r"\s+\d{5}(?:-\d{4})?$", "", s)
    s = _STORE_NUM.sub("", s)
    s = _NON_ALNUM.sub(" ", s)
    s = _SPACES.sub(" ", s).strip()
    return s


def parse_who(value) -> str:
    if value is None:
        return "shared"
    text = str(value).strip().upper()
    if text in ("A", "S"):
        return text
    return "shared"


def csv_fingerprint(last4: str | None, txn_date, amount_cents: int, description: str) -> str:
    import hashlib

    key = f"{last4 or ''}|{txn_date}|{amount_cents}|{normalize_merchant(description)}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:32]
