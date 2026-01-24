from os import getenv
from pathlib import Path

RESOURCE_DIR = Path(getenv("RESOURCE_DIR", Path.cwd()))
ATTACKTRACE_CONFIG_DIR = Path(getenv("ATTACKTRACE_CONFIG_DIR", Path.cwd()))
