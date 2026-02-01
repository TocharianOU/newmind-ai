"""MCP Package Manager - Manages locally downloaded packages"""
import json
import logging
import shutil
import subprocess
import tarfile
import tempfile
from dataclasses import dataclass
from pathlib import Path

import httpx

logger = logging.getLogger("PackageManager")


@dataclass
class PackageInfo:
    """Package information"""
    name: str
    version: str
    install_path: Path
    package_json: dict | None = None


class PackageManager:
    """Manages MCP package download, deletion, and listing"""
    
    def __init__(self, packages_dir: Path):
        self.packages_dir = packages_dir
        self.packages_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"PackageManager initialized with directory: {self.packages_dir}")
    
    def list_packages(self) -> list[PackageInfo]:
        """List all downloaded packages"""
        packages = []
        for pkg_dir in self.packages_dir.iterdir():
            if not pkg_dir.is_dir():
                continue
            
            # Package directory format: name@version
            try:
                package_json_path = pkg_dir / "package.json"
                pkg_json = None
                if package_json_path.exists():
                    with open(package_json_path) as f:
                        pkg_json = json.load(f)
                
                # Parse directory name
                if '@' in pkg_dir.name:
                    name, version = pkg_dir.name.rsplit('@', 1)
                    packages.append(PackageInfo(
                        name=name,
                        version=version,
                        install_path=pkg_dir,
                        package_json=pkg_json
                    ))
            except Exception as e:
                logger.warning(f"Failed to parse package directory {pkg_dir}: {e}")
                continue
        
        return packages
    
    def get_package(self, name: str, version: str) -> PackageInfo | None:
        """Get a specific package"""
        install_dir = self.packages_dir / f"{name}@{version}"
        if not install_dir.exists():
            return None
        
        package_json_path = install_dir / "package.json"
        pkg_json = None
        if package_json_path.exists():
            try:
                with open(package_json_path) as f:
                    pkg_json = json.load(f)
            except Exception as e:
                logger.warning(f"Failed to read package.json for {name}@{version}: {e}")
        
        return PackageInfo(name, version, install_dir, pkg_json)
    
    async def download_package(
        self, name: str, version: str, download_url: str
    ) -> PackageInfo:
        """Download and extract package
        
        If package already exists, return it directly; otherwise download, extract and install dependencies
        """
        install_dir = self.packages_dir / f"{name}@{version}"
        
        # If package already exists, return it directly
        if install_dir.exists():
            logger.info(f"Package {name}@{version} already exists at {install_dir}")
            pkg = self.get_package(name, version)
            if pkg:
                return pkg
        
        logger.info(f"Downloading {name}@{version} from {download_url}...")
        
        temp_path = None
        try:
            # Download to temporary file
            with tempfile.NamedTemporaryFile(suffix='.tar.gz', delete=False) as temp_file:
                temp_path = Path(temp_file.name)
                
                async with httpx.AsyncClient(follow_redirects=True, timeout=300.0) as client:
                    async with client.stream('GET', download_url) as response:
                        response.raise_for_status()
                        
                        total_size = int(response.headers.get('content-length', 0))
                        downloaded = 0
                        
                        with open(temp_path, 'wb') as f:
                            async for chunk in response.aiter_bytes(chunk_size=8192):
                                f.write(chunk)
                                downloaded += len(chunk)
                                if total_size > 0:
                                    progress = (downloaded / total_size) * 100
                                    if downloaded % (1024 * 1024) == 0:  # Log every 1MB
                                        logger.debug(f"Download progress: {progress:.1f}%")
            
            # Extract package
            logger.info(f"Extracting package to {install_dir}...")
            install_dir.mkdir(parents=True, exist_ok=True)
            
            with tarfile.open(temp_path, 'r:gz') as tar:
                # Security check: prevent path traversal attacks
                def is_within_directory(directory, target):
                    abs_directory = Path(directory).resolve()
                    abs_target = Path(target).resolve()
                    return abs_target.is_relative_to(abs_directory)
                
                members = tar.getmembers()
                for member in members:
                    member_path = install_dir / member.name
                    if not is_within_directory(install_dir, member_path):
                        raise Exception(f"Attempted path traversal in tar file: {member.name}")
                
                tar.extractall(install_dir)
            
            logger.info(f"Package extracted successfully")
            
            # Run npm install (if package.json exists)
            package_json = install_dir / "package.json"
            if package_json.exists():
                logger.info(f"Running npm install for {name}@{version}...")
                try:
                    result = subprocess.run(
                        ['npm', 'install', '--omit=dev', '--legacy-peer-deps'],
                        cwd=install_dir,
                        capture_output=True,
                        text=True,
                        timeout=300
                    )
                    if result.returncode != 0:
                        logger.warning(f"npm install had warnings: {result.stderr}")
                    else:
                        logger.info(f"npm install completed successfully")
                except subprocess.TimeoutExpired:
                    logger.error(f"npm install timed out for {name}@{version}")
                except FileNotFoundError:
                    logger.warning(f"npm not found, skipping dependency installation")
                except Exception as e:
                    logger.error(f"npm install failed: {e}")
            
            return self.get_package(name, version)
            
        except Exception as e:
            logger.error(f"Failed to download/install package {name}@{version}: {e}")
            # Clean up failed installation
            if install_dir.exists():
                shutil.rmtree(install_dir, ignore_errors=True)
            raise
        finally:
            # Clean up temporary file
            if temp_path and temp_path.exists():
                temp_path.unlink(missing_ok=True)
    
    def delete_package(self, name: str, version: str) -> bool:
        """Delete package (does not check if in use by instances)"""
        install_dir = self.packages_dir / f"{name}@{version}"
        if install_dir.exists():
            try:
                shutil.rmtree(install_dir)
                logger.info(f"Deleted package {name}@{version}")
                return True
            except Exception as e:
                logger.error(f"Failed to delete package {name}@{version}: {e}")
                return False
        else:
            logger.warning(f"Package {name}@{version} not found")
            return False
    
    def check_update(self, name: str, current_version: str, latest_version: str) -> bool:
        """Check if update is available (simple version comparison)"""
        return current_version != latest_version
