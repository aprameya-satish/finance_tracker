from app.core.config import get_settings
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


def _engine():
    settings = get_settings()
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    url = f"sqlite:///{settings.db_path}"
    return create_engine(url, connect_args={"check_same_thread": False})


engine = _engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app.db import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
