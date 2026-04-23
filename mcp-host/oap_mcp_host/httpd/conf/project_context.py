"""
Project context management module
Manages the current active project and project-related paths
"""
from pathlib import Path
from typing import Optional
import json
import logging
import re
from contextlib import contextmanager
import threading
import os

from ...env import OAP_CONFIG_DIR

logger = logging.getLogger(__name__)

# Only allow safe project/user IDs: alphanumeric, hyphens, underscores, dots.
# Max 128 characters to prevent overly long paths.
_SAFE_ID_RE = re.compile(r'^[a-zA-Z0-9._-]{1,128}$')


def _assert_safe_id(value: str, label: str = "id") -> str:
    """Validate that a project/user ID is safe to use as a filesystem path component.

    Raises ValueError if the value contains path-traversal sequences or
    characters outside the allowed set.
    """
    if not value or not _SAFE_ID_RE.match(value):
        raise ValueError(
            f"Invalid {label} '{value}': only alphanumeric, '-', '_', '.' characters "
            f"are allowed (max 128 chars)"
        )
    return value

# Thread-local storage for current request's project ID
_thread_local = threading.local()

# Default project ID
DEFAULT_PROJECT_ID = "default"


def _current_user_id() -> str | None:
    """Return current process user id (injected by Electron)."""
    uid = os.environ.get("ATTACKTRACE_USER_ID")
    return uid or None


def _project_root_dir() -> Path:
    """Return project root directory for current user context.

    Authenticated user:
      ~/.attacktrace/users/{user_id}/projects/
    Legacy/offline fallback:
      ~/.attacktrace/projects/
    """
    base = OAP_CONFIG_DIR.parent
    uid = _current_user_id()
    if uid:
        return base / "users" / uid / "projects"
    return base / "projects"


def _current_project_file_path() -> Path:
    """Return current project file path for current user context."""
    base = OAP_CONFIG_DIR.parent
    uid = _current_user_id()
    if uid:
        return base / "users" / uid / "current_project.json"
    return base / "current_project.json"


def get_current_project_id() -> str:
    """Get current thread's project ID"""
    # If thread-local not set, try to load from file
    if not hasattr(_thread_local, 'project_id'):
        _thread_local.project_id = load_current_project()
    return getattr(_thread_local, 'project_id', DEFAULT_PROJECT_ID)


def set_current_project_id(project_id: Optional[str]):
    """Set current thread's project ID"""
    pid = project_id or DEFAULT_PROJECT_ID
    _assert_safe_id(pid, "project_id")
    _thread_local.project_id = pid


@contextmanager
def project_context(project_id: Optional[str]):
    """Project context manager"""
    old_project_id = get_current_project_id()
    try:
        set_current_project_id(project_id)
        yield project_id or DEFAULT_PROJECT_ID
    finally:
        set_current_project_id(old_project_id)


def get_project_dir(project_id: Optional[str] = None) -> Path:
    """
    Get project directory path

    Args:
        project_id: Project ID, uses current thread's project ID if None

    Returns:
        Project directory path

    Raises:
        ValueError: if project_id contains unsafe characters (path traversal prevention)
    """
    pid = project_id or get_current_project_id()
    _assert_safe_id(pid, "project_id")

    root = _project_root_dir()
    project_dir = root / pid

    # Belt-and-suspenders: verify the resolved path stays inside the root
    resolved = project_dir.resolve()
    resolved_root = root.resolve()
    if resolved != resolved_root and not str(resolved).startswith(str(resolved_root) + os.sep):
        raise ValueError(f"Resolved project path escapes root: {resolved}")

    project_dir.mkdir(parents=True, exist_ok=True)
    return project_dir


def get_project_config_path(project_id: Optional[str] = None) -> Path:
    """
    Get project's MCP config file path
    
    Args:
        project_id: Project ID
        
    Returns:
        Config file path: ~/.attacktrace/projects/{project_id}/mcp_config.json
    """
    return get_project_dir(project_id) / "mcp_config.json"


def get_project_db_path(project_id: Optional[str] = None) -> Path:
    """
    Get project's database file path
    
    Args:
        project_id: Project ID
        
    Returns:
        Database file path: ~/.attacktrace/projects/{project_id}/db.sqlite
    """
    return get_project_dir(project_id) / "db.sqlite"


def get_project_cache_dir(project_id: Optional[str] = None) -> Path:
    """
    Get project's cache directory path
    
    Args:
        project_id: Project ID
        
    Returns:
        Cache directory path: ~/.attacktrace/projects/{project_id}/cache/
    """
    cache_dir = get_project_dir(project_id) / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


def get_project_reports_dir(project_id: Optional[str] = None) -> Path:
    """
    Get project's reports directory path
    
    Args:
        project_id: Project ID
        
    Returns:
        Reports directory path: ~/.attacktrace/projects/{project_id}/reports/
    """
    reports_dir = get_project_dir(project_id) / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    return reports_dir


def load_current_project() -> str:
    """
    Load current active project ID from config file
    
    Returns:
        Project ID, defaults to 'default'
    """
    current_project_file = _current_project_file_path()
    
    if current_project_file.exists():
        try:
            with open(current_project_file, 'r') as f:
                data = json.load(f)
                return data.get('projectId', DEFAULT_PROJECT_ID)
        except Exception:
            pass
    
    return DEFAULT_PROJECT_ID


def save_current_project(project_id: str):
    """
    Save current active project ID to config file
    
    Args:
        project_id: Project ID
    """
    current_project_file = _current_project_file_path()
    
    try:
        current_project_file.parent.mkdir(parents=True, exist_ok=True)
        with open(current_project_file, 'w') as f:
            json.dump({'projectId': project_id}, f, indent=2)
    except Exception as e:
        logger.error("Failed to save current project: %s", e)


def ensure_default_project():
    """
    Ensure default project directory exists
    """
    default_dir = get_project_dir(DEFAULT_PROJECT_ID)
    
    # If default project doesn't exist, try to migrate old config
    old_config_path = OAP_CONFIG_DIR / "mcp_config.json"
    new_config_path = default_dir / "mcp_config.json"
    
    if old_config_path.exists() and not new_config_path.exists():
        import shutil
        try:
            shutil.copy2(old_config_path, new_config_path)
            logger.info("Migrated old config to default project: %s", new_config_path)
        except Exception as e:
            logger.error("Failed to migrate old config: %s", e)
    
    # Also handle database file
    old_db_path = OAP_CONFIG_DIR / "db.sqlite"
    new_db_path = default_dir / "db.sqlite"
    
    if old_db_path.exists() and not new_db_path.exists():
        import shutil
        try:
            shutil.copy2(old_db_path, new_db_path)
            logger.info("Migrated old database to default project: %s", new_db_path)
        except Exception as e:
            logger.error("Failed to migrate old database: %s", e)
