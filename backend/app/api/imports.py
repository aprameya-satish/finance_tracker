from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.engine import get_db
from app.schemas.dtos import ImportDirectoryIn, ImportResultOut
from app.services.csv_import import import_directory, import_uploads

router = APIRouter(prefix="/imports", tags=["imports"])

MAX_UPLOAD_BYTES = 12 * 1024 * 1024


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


@router.post("/upload", response_model=ImportResultOut)
async def import_uploaded_files(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    uploads: list[tuple[str, bytes]] = []
    for uploaded in files:
        name = uploaded.filename or "statement.csv"
        data = await uploaded.read()
        if not data:
            continue
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, f"{name} exceeds the 12 MB upload limit")
        uploads.append((name, data))
    if not uploads:
        raise HTTPException(400, "upload at least one CSV file")
    try:
        result = import_uploads(db, uploads)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return ImportResultOut(
        files=result.files,
        rows_ok=result.rows_ok,
        rows_skipped=result.rows_skipped,
        errors=result.errors,
    )
