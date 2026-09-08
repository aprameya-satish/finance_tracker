from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.engine import get_db
from app.schemas.dtos import ImportDirectoryIn, ImportResultOut
from app.services.csv_import import import_directory

router = APIRouter(prefix="/imports", tags=["imports"])


@router.post("/directory", response_model=ImportResultOut)
def import_from_directory(body: ImportDirectoryIn | None = None, db: Session = Depends(get_db)):
    settings = get_settings()
    directory = (body.directory if body else None) or settings.csv_import_directory
    if not directory:
        raise HTTPException(400, "directory is required")
    try:
        result = import_directory(db, directory)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    return ImportResultOut(
        files=result.files,
        rows_ok=result.rows_ok,
        rows_skipped=result.rows_skipped,
        errors=result.errors,
    )
