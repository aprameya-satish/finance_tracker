from pathlib import Path

from cryptography.fernet import Fernet

from app.core.config import DATA_DIR, get_settings

_KEY_FILE = DATA_DIR / "token.key"


def _load_fernet() -> Fernet:
    settings = get_settings()
    key = (settings.plaid_token_key or "").strip()
    if key:
        return Fernet(key.encode() if isinstance(key, str) else key)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if _KEY_FILE.exists():
        return Fernet(_KEY_FILE.read_bytes().strip())
    generated = Fernet.generate_key()
    _KEY_FILE.write_bytes(generated)
    return Fernet(generated)


def encrypt_token(plaintext: str) -> str:
    return _load_fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_token(ciphertext: str) -> str:
    return _load_fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
