"""
Project context management module
Manages the current active project and project-related paths
"""
from pathlib import Path
from typing import Optional
import json
from contextlib import contextmanager
import threading

from ...env import ATTACKTRACE_CONFIG_DIR

# Thread-local storage for current request's project ID
_thread_local = threading.local()

# Default project ID
DEFAULT_PROJECT_ID = "default"


def get_current_project_id() -> str:
    """Get current thread's project ID"""
    # If thread-local not set, try to load from file
    if not hasattr(_thread_local, 'project_id'):
        _thread_local.project_id = load_current_project()
    return getattr(_thread_local, 'project_id', DEFAULT_PROJECT_ID)


def set_current_project_id(project_id: Optional[str]):
    """Set current thread's project ID"""
    _thread_local.project_id = project_id or DEFAULT_PROJECT_ID


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
    """
    pid = project_id or get_current_project_id()
    
    # Project directory: ~/.attacktrace/projects/{project_id}/
    project_dir = ATTACKTRACE_CONFIG_DIR.parent / "projects" / pid
    
    # Ensure directory exists
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
    current_project_file = ATTACKTRACE_CONFIG_DIR.parent / "current_project.json"
    
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
    current_project_file = ATTACKTRACE_CONFIG_DIR.parent / "current_project.json"
    
    try:
        current_project_file.parent.mkdir(parents=True, exist_ok=True)
        with open(current_project_file, 'w') as f:
            json.dump({'projectId': project_id}, f, indent=2)
    except Exception as e:
        print(f"Failed to save current project: {e}")


def ensure_default_project():
    """
    Ensure default project directory exists
    """
    default_dir = get_project_dir(DEFAULT_PROJECT_ID)
    
    # If default project doesn't exist, try to migrate old config
    old_config_path = ATTACKTRACE_CONFIG_DIR / "mcp_config.json"
    new_config_path = default_dir / "mcp_config.json"
    
    if old_config_path.exists() and not new_config_path.exists():
        # Migrate old config to default project
        import shutil
        try:
            shutil.copy2(old_config_path, new_config_path)
            print(f"Migrated old config to default project: {new_config_path}")
        except Exception as e:
            print(f"Failed to migrate old config: {e}")
    
    # Also handle database file
    old_db_path = ATTACKTRACE_CONFIG_DIR / "db.sqlite"
    new_db_path = default_dir / "db.sqlite"
    
    if old_db_path.exists() and not new_db_path.exists():
        import shutil
        try:
            shutil.copy2(old_db_path, new_db_path)
            print(f"Migrated old database to default project: {new_db_path}")
        except Exception as e:
            print(f"Failed to migrate old database: {e}")
