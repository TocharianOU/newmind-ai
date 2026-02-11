"""Database field-level encryption using Fernet (AES-128).

This module provides application-layer encryption for sensitive database fields.
No external dependencies required - uses pure Python cryptography library.

Key features:
- Pure Python implementation (no SQLCipher needed)
- Cross-platform (macOS/Linux/Windows)
- Keys stored in system keychain
- Transparent encryption/decryption via SQLAlchemy events
"""

import base64
import secrets
import subprocess
import sys
from logging import getLogger
from typing import Optional

from cryptography.fernet import Fernet

logger = getLogger(__name__)

# Service name for keychain storage
KEYCHAIN_SERVICE = "com.attacktrace.database"
KEYCHAIN_ACCOUNT_PREFIX = "encryption-key"


class DatabaseEncryption:
    """Manage database field encryption using Fernet (AES-128)."""

    def __init__(self, project_id: str = "default"):
        """Initialize database encryption manager.
        
        Args:
            project_id: Project identifier for key isolation
        """
        self.project_id = project_id
        self.keychain_account = f"{KEYCHAIN_ACCOUNT_PREFIX}-{project_id}"
        self._cached_fernet: Optional[Fernet] = None

    def get_fernet(self) -> Fernet:
        """Get or create Fernet cipher instance.
        
        Returns:
            Fernet cipher instance for encryption/decryption
        """
        if self._cached_fernet:
            return self._cached_fernet

        # Get or generate encryption key
        key = self._get_key_from_keychain()
        
        if not key:
            # Generate new Fernet key (32 url-safe base64 bytes)
            key = Fernet.generate_key().decode('utf-8')
            self._store_key_in_keychain(key)
            logger.info(f"[Encryption] Generated new encryption key for project '{self.project_id}'")
        else:
            logger.info(f"[Encryption] Retrieved encryption key for project '{self.project_id}'")

        self._cached_fernet = Fernet(key.encode('utf-8'))
        return self._cached_fernet

    def encrypt(self, plaintext: str) -> str:
        """Encrypt a string value.
        
        Args:
            plaintext: String to encrypt
            
        Returns:
            Base64-encoded encrypted string
        """
        if not plaintext:
            return plaintext
        
        fernet = self.get_fernet()
        encrypted_bytes = fernet.encrypt(plaintext.encode('utf-8'))
        return encrypted_bytes.decode('utf-8')

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt an encrypted string value.
        
        Args:
            ciphertext: Base64-encoded encrypted string
            
        Returns:
            Decrypted plaintext string
        """
        if not ciphertext:
            return ciphertext
        
        try:
            fernet = self.get_fernet()
            decrypted_bytes = fernet.decrypt(ciphertext.encode('utf-8'))
            return decrypted_bytes.decode('utf-8')
        except Exception as e:
            logger.error(f"[Encryption] Failed to decrypt value: {e}")
            # Return original value if decryption fails (for backward compatibility)
            return ciphertext

    def _get_key_from_keychain(self) -> Optional[str]:
        """Retrieve encryption key from system keychain.
        
        Returns:
            Base64-encoded Fernet key or None if not found
        """
        try:
            if sys.platform == "darwin":
                return self._get_key_macos()
            elif sys.platform == "win32":
                return self._get_key_windows()
            elif sys.platform.startswith("linux"):
                return self._get_key_linux()
            else:
                logger.warning(f"[Encryption] Unsupported platform: {sys.platform}")
                return None
        except Exception as e:
            logger.error(f"[Encryption] Failed to retrieve key from keychain: {e}")
            return None

    def _store_key_in_keychain(self, key: str) -> bool:
        """Store encryption key in system keychain.
        
        Args:
            key: Base64-encoded Fernet key
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if sys.platform == "darwin":
                return self._store_key_macos(key)
            elif sys.platform == "win32":
                return self._store_key_windows(key)
            elif sys.platform.startswith("linux"):
                return self._store_key_linux(key)
            else:
                logger.warning(f"[Encryption] Unsupported platform: {sys.platform}")
                return False
        except Exception as e:
            logger.error(f"[Encryption] Failed to store key in keychain: {e}")
            return False

    # macOS Keychain implementation
    def _get_key_macos(self) -> Optional[str]:
        """Get key from macOS Keychain."""
        try:
            result = subprocess.run(
                [
                    "security",
                    "find-generic-password",
                    "-s", KEYCHAIN_SERVICE,
                    "-a", self.keychain_account,
                    "-w"  # Output password only
                ],
                capture_output=True,
                text=True,
                check=False
            )
            
            if result.returncode == 0:
                return result.stdout.strip()
            return None
        except Exception as e:
            logger.debug(f"[Encryption] macOS keychain read failed: {e}")
            return None

    def _store_key_macos(self, key: str) -> bool:
        """Store key in macOS Keychain."""
        try:
            # Delete existing key if present
            subprocess.run(
                [
                    "security",
                    "delete-generic-password",
                    "-s", KEYCHAIN_SERVICE,
                    "-a", self.keychain_account
                ],
                capture_output=True,
                check=False
            )
            
            # Add new key
            result = subprocess.run(
                [
                    "security",
                    "add-generic-password",
                    "-s", KEYCHAIN_SERVICE,
                    "-a", self.keychain_account,
                    "-w", key,
                    "-U"  # Update if exists
                ],
                capture_output=True,
                check=True
            )
            
            return result.returncode == 0
        except Exception as e:
            logger.error(f"[Encryption] macOS keychain write failed: {e}")
            return False

    # Windows Credential Manager implementation
    def _get_key_windows(self) -> Optional[str]:
        """Get key from Windows Credential Manager."""
        try:
            import keyring
            key = keyring.get_password(KEYCHAIN_SERVICE, self.keychain_account)
            return key
        except ImportError:
            logger.warning("[Encryption] keyring library not available on Windows")
            return None
        except Exception as e:
            logger.debug(f"[Encryption] Windows credential read failed: {e}")
            return None

    def _store_key_windows(self, key: str) -> bool:
        """Store key in Windows Credential Manager."""
        try:
            import keyring
            keyring.set_password(KEYCHAIN_SERVICE, self.keychain_account, key)
            return True
        except ImportError:
            logger.warning("[Encryption] keyring library not available on Windows")
            return False
        except Exception as e:
            logger.error(f"[Encryption] Windows credential write failed: {e}")
            return False

    # Linux Secret Service implementation
    def _get_key_linux(self) -> Optional[str]:
        """Get key from Linux Secret Service (gnome-keyring/kwallet)."""
        try:
            import keyring
            key = keyring.get_password(KEYCHAIN_SERVICE, self.keychain_account)
            return key
        except ImportError:
            logger.warning("[Encryption] keyring library not available on Linux")
            return None
        except Exception as e:
            logger.debug(f"[Encryption] Linux secret service read failed: {e}")
            return None

    def _store_key_linux(self, key: str) -> bool:
        """Store key in Linux Secret Service."""
        try:
            import keyring
            keyring.set_password(KEYCHAIN_SERVICE, self.keychain_account, key)
            return True
        except ImportError:
            logger.warning("[Encryption] keyring library not available on Linux")
            return False
        except Exception as e:
            logger.error(f"[Encryption] Linux secret service write failed: {e}")
            return False


# Global encryption manager instance (initialized per project)
_encryption_managers: dict[str, DatabaseEncryption] = {}


def get_encryption_manager(project_id: str = "default") -> DatabaseEncryption:
    """Get or create encryption manager for a project.
    
    Args:
        project_id: Project identifier
        
    Returns:
        DatabaseEncryption instance
    """
    if project_id not in _encryption_managers:
        _encryption_managers[project_id] = DatabaseEncryption(project_id)
    return _encryption_managers[project_id]


def encrypt_value(value: str, project_id: str = "default") -> str:
    """Encrypt a string value.
    
    Args:
        value: Plaintext string
        project_id: Project identifier
        
    Returns:
        Encrypted string
    """
    manager = get_encryption_manager(project_id)
    return manager.encrypt(value)


def decrypt_value(value: str, project_id: str = "default") -> str:
    """Decrypt an encrypted string value.
    
    Args:
        value: Encrypted string
        project_id: Project identifier
        
    Returns:
        Decrypted plaintext string
    """
    manager = get_encryption_manager(project_id)
    return manager.decrypt(value)
