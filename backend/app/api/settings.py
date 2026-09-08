from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.engine import get_db
from app.db.models import AppSetting
from app.schemas.dtos import SettingsIn, SettingsOut
from app.services.plaid_service import plaid_configured

router = APIRouter(prefix="/settings", tags=["settings"])

DEFAULTS = {
    "person_a": "Aprameya",
    "person_s": "Savanthi",
    "csv_import_directory": "",
}


def _get(db: Session, key: str) -> str:
    row = db.query(AppSetting).filter_by(key=key).one_or_none()
    if row:
        return row.value
    if key == "csv_import_directory":
        return get_settings().csv_import_directory
    return DEFAULTS.get(key, "")


def _set(db: Session, key: str, value: str) -> None:
    row = db.query(AppSetting).filter_by(key=key).one_or_none()
    if row:
        row.value = value
    else:
        db.add(AppSetting(key=key, value=value))


@router.get("", response_model=SettingsOut)
def get_settings_api(db: Session = Depends(get_db)):
    s = get_settings()
    return SettingsOut(
        person_a=_get(db, "person_a") or DEFAULTS["person_a"],
        person_s=_get(db, "person_s") or DEFAULTS["person_s"],
        csv_import_directory=_get(db, "csv_import_directory"),
        plaid_configured=plaid_configured(),
        plaid_env=s.plaid_env,
        plaid_products=s.plaid_product_list,
    )


@router.put("", response_model=SettingsOut)
def put_settings(body: SettingsIn, db: Session = Depends(get_db)):
    if body.person_a is not None:
        _set(db, "person_a", body.person_a)
    if body.person_s is not None:
        _set(db, "person_s", body.person_s)
    if body.csv_import_directory is not None:
        _set(db, "csv_import_directory", body.csv_import_directory)
    db.commit()
    return get_settings_api(db)
