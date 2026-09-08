from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.engine import get_db
from app.db.models import Category
from app.schemas.dtos import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.name).all()


@router.post("", response_model=CategoryOut)
def create_category(body: CategoryCreate, db: Session = Depends(get_db)):
    if db.query(Category).filter_by(name=body.name).one_or_none():
        raise HTTPException(409, "category exists")
    cat = Category(name=body.name, include_in_budget=body.include_in_budget)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, body: CategoryUpdate, db: Session = Depends(get_db)):
    cat = db.query(Category).filter_by(id=category_id).one_or_none()
    if not cat:
        raise HTTPException(404, "category not found")
    if body.name is not None:
        cat.name = body.name
    if body.include_in_budget is not None:
        cat.include_in_budget = body.include_in_budget
    if body.is_archived is not None:
        cat.is_archived = body.is_archived
    db.commit()
    db.refresh(cat)
    return cat
