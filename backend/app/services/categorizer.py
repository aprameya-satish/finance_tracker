from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Optional

import joblib
from rapidfuzz import fuzz, process
from sqlalchemy.orm import Session

from app.core.config import DATA_DIR
from app.db.models import AppSetting, Category, MerchantRule, Transaction
from app.services.merchant import normalize_merchant

MODEL_DIR = DATA_DIR / "categorizer"
CONFIDENCE_REVIEW = 0.75
RETRAIN_EVERY = 10
CORRECTION_KEY = "user_corrections_since_train"

PLAID_PFC_MAP = {
    "FOOD_AND_DRINK": "Restaurants",
    "GENERAL_MERCHANDISE": "Shopping",
    "RENT_AND_UTILITIES": "Utilities",
    "TRANSPORTATION": "Auto",
    "TRAVEL": "Travel",
    "ENTERTAINMENT": "Entertainment",
    "MEDICAL": "Health",
    "PERSONAL_CARE": "Health",
    "GENERAL_SERVICES": "Administrative",
    "GOVERNMENT_AND_NON_PROFIT": "Administrative",
    "BANK_FEES": "Administrative",
    "HOME_IMPROVEMENT": "Home",
    "LOAN_PAYMENTS": "Mortgage",
    "TRANSFER_IN": "Transfer",
    "TRANSFER_OUT": "Transfer",
    "INCOME": "Income",
}


def rebuild_merchant_rules(db: Session) -> int:
    labeled = (
        db.query(Transaction)
        .filter(Transaction.category_id.isnot(None), Transaction.merchant_norm != "")
        .all()
    )
    votes: dict[str, Counter] = defaultdict(Counter)
    for txn in labeled:
        votes[txn.merchant_norm][(txn.category_id, txn.who)] += 1
    existing = {r.merchant_norm: r for r in db.query(MerchantRule).all()}
    count = 0
    for merchant, counter in votes.items():
        (cat_id, who), hits = counter.most_common(1)[0]
        rule = existing.get(merchant)
        if rule:
            rule.category_id = cat_id
            rule.who = who
            rule.hit_count = hits
            rule.last_used = datetime.utcnow()
        else:
            db.add(
                MerchantRule(
                    merchant_norm=merchant,
                    category_id=cat_id,
                    who=who,
                    hit_count=hits,
                    last_used=datetime.utcnow(),
                )
            )
        count += 1
    db.flush()
    return count


def _texts_and_labels(db: Session):
    rows = (
        db.query(Transaction)
        .filter(Transaction.category_id.isnot(None))
        .all()
    )
    texts = [f"{t.merchant_norm} {t.description_raw}".strip() for t in rows]
    cats = [t.category_id for t in rows]
    whos = [t.who for t in rows]
    return texts, cats, whos


def train_models(db: Session) -> dict:
    texts, cats, whos = _texts_and_labels(db)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    info = {"trained": False, "samples": len(texts)}
    if len(texts) < 12 or len(set(cats)) < 2:
        return info
    from sklearn.calibration import CalibratedClassifierCV
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.pipeline import Pipeline
    from sklearn.svm import LinearSVC

    cat_pipe = Pipeline(
        [
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=1)),
            ("clf", CalibratedClassifierCV(LinearSVC(max_iter=4000), cv=3)),
        ]
    )
    who_pipe = Pipeline(
        [
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=1)),
            ("clf", CalibratedClassifierCV(LinearSVC(max_iter=4000), cv=3)),
        ]
    )
    try:
        cat_pipe.fit(texts, cats)
        who_pipe.fit(texts, whos)
        joblib.dump(cat_pipe, MODEL_DIR / "category.joblib")
        joblib.dump(who_pipe, MODEL_DIR / "who.joblib")
        info["trained"] = True
    except Exception:
        info["trained"] = False
    return info


def _load_model(name: str):
    path = MODEL_DIR / name
    if not path.exists():
        return None
    return joblib.load(path)


def _fuzzy_rule(merchant: str, rules: list[MerchantRule]) -> Optional[MerchantRule]:
    if not merchant or not rules:
        return None
    choices = {r.merchant_norm: r for r in rules if r.merchant_norm}
    match = process.extractOne(merchant, choices.keys(), scorer=fuzz.token_set_ratio)
    if match and match[1] >= 90:
        return choices[match[0]]
    return None


def predict_one(
    db: Session,
    *,
    merchant_norm: str,
    description: str,
    plaid_pfc: Optional[str] = None,
) -> dict:
    rules = db.query(MerchantRule).all()
    by_name = {r.merchant_norm: r for r in rules}
    if merchant_norm in by_name:
        rule = by_name[merchant_norm]
        conf = 0.95 if rule.hit_count >= 2 else 0.82
        return {
            "category_id": rule.category_id,
            "who": rule.who,
            "confidence": conf,
            "source": "rule",
        }
    fuzzy = _fuzzy_rule(merchant_norm, rules)
    if fuzzy:
        return {
            "category_id": fuzzy.category_id,
            "who": fuzzy.who,
            "confidence": 0.72,
            "source": "rule",
        }
    cat_model = _load_model("category.joblib")
    who_model = _load_model("who.joblib")
    text = f"{merchant_norm} {description}".strip()
    if cat_model is not None:
        try:
            proba = cat_model.predict_proba([text])[0]
            idx = int(proba.argmax())
            cat_id = int(cat_model.classes_[idx])
            conf = float(proba[idx])
            who = "shared"
            if who_model is not None:
                wproba = who_model.predict_proba([text])[0]
                who = str(who_model.classes_[int(wproba.argmax())])
            return {
                "category_id": cat_id,
                "who": who,
                "confidence": conf,
                "source": "model",
            }
        except Exception:
            pass
    if plaid_pfc:
        mapped = PLAID_PFC_MAP.get(plaid_pfc)
        if mapped:
            cat = db.query(Category).filter_by(name=mapped).one_or_none()
            if cat:
                return {
                    "category_id": cat.id,
                    "who": "shared",
                    "confidence": 0.4,
                    "source": "plaid_map",
                }
    return {"category_id": None, "who": "shared", "confidence": 0.0, "source": None}


def apply_prediction(txn: Transaction, pred: dict, *, overwrite_user: bool = False) -> None:
    if pred.get("category_id") and (overwrite_user or txn.category_source != "user"):
        if not txn.category_id or txn.category_source != "user":
            txn.category_id = pred["category_id"]
            txn.category_source = pred.get("source")
            txn.category_confidence = pred.get("confidence")
    if pred.get("who") and (overwrite_user or txn.who_source != "user"):
        if txn.who_source != "user":
            txn.who = pred["who"]
            if pred.get("source") in {"rule", "model"}:
                txn.who_source = pred["source"]


def categorize_unlabeled(db: Session, only_missing: bool = True) -> int:
    q = db.query(Transaction)
    if only_missing:
        q = q.filter((Transaction.category_id.is_(None)) | (Transaction.category_confidence < CONFIDENCE_REVIEW))
    n = 0
    for txn in q.all():
        if txn.category_source == "user" and txn.who_source == "user":
            continue
        pred = predict_one(
            db,
            merchant_norm=txn.merchant_norm or normalize_merchant(txn.description_raw),
            description=txn.description_raw,
            plaid_pfc=txn.plaid_pfc_primary,
        )
        apply_prediction(txn, pred)
        n += 1
    db.flush()
    return n


def note_user_correction(db: Session) -> dict | None:
    row = db.query(AppSetting).filter_by(key=CORRECTION_KEY).one_or_none()
    if row is None:
        row = AppSetting(key=CORRECTION_KEY, value="0")
        db.add(row)
        db.flush()
    count = int(row.value or "0") + 1
    row.value = str(count)
    if count < RETRAIN_EVERY:
        return None
    info = train_models(db)
    row.value = "0"
    return info


def upsert_user_rule(db: Session, merchant_norm: str, category_id: int | None, who: str) -> None:
    if not merchant_norm:
        return
    rule = db.query(MerchantRule).filter_by(merchant_norm=merchant_norm).one_or_none()
    if rule:
        rule.category_id = category_id
        rule.who = who
        rule.hit_count = (rule.hit_count or 0) + 1
        rule.last_used = datetime.utcnow()
    else:
        db.add(
            MerchantRule(
                merchant_norm=merchant_norm,
                category_id=category_id,
                who=who,
                hit_count=1,
                last_used=datetime.utcnow(),
            )
        )
