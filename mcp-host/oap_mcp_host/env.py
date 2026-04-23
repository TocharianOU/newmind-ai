from os import getenv
from pathlib import Path

RESOURCE_DIR = Path(getenv("RESOURCE_DIR", Path.cwd()))
OAP_CONFIG_DIR = Path(getenv("OAP_CONFIG_DIR", Path.cwd()))
