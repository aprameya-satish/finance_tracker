from fastapi import Header, HTTPException

from app.core.config import get_settings


def require_api_key(x_finance_key: str | None = Header(default=None, alias="X-Finance-Key")) -> None:
    secret = (get_settings().api_shared_secret or "").strip()
    if not secret:
        return
    provided = (x_finance_key or "").strip()
    if provided != secret:
        raise HTTPException(401, "invalid API key")
