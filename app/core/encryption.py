from cryptography.fernet import Fernet
import os
from typing import Optional

# This should be a 32-byte key generated using Fernet.generate_key()
# In production, this MUST be set in environment variables.
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", Fernet.generate_key().decode())

cipher_suite = Fernet(ENCRYPTION_KEY.encode())

def encrypt_value(value: str) -> str:
    if not value:
        return ""
    return cipher_suite.encrypt(value.encode()).decode()

def decrypt_value(encrypted_value: str) -> Optional[str]:
    if not encrypted_value:
        return None
    try:
        return cipher_suite.decrypt(encrypted_value.encode()).decode()
    except Exception:
        return None
