"""MCP Package Manager - Manages locally downloaded packages"""
import hashlib
import json
import logging
import shutil
import subprocess
import tarfile
import tempfile
from dataclasses import dataclass
from datetime import datetime
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
    
    def _calculate_file_hash(self, file_path: Path, algorithm: str) -> str:
        """Calculate file hash using specified algorithm
        
        Args:
            file_path: Path to the file
            algorithm: Hash algorithm (e.g., 'sha256', 'sha512')
        
        Returns:
            Hex digest of the hash
        """
        hash_obj = hashlib.new(algorithm)
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                hash_obj.update(chunk)
        return hash_obj.hexdigest()
    
    def _verify_package_integrity(self, temp_path: Path, sha256: str = None, sha512: str = None) -> bool:
        """Verify downloaded package integrity using hash
        
        Args:
            temp_path: Path to the temporary downloaded file
            sha256: Expected SHA256 hash (optional)
            sha512: Expected SHA512 hash (optional)
        
        Returns:
            True if verification passes or no hash provided, False otherwise
        """
        if sha256:
            calculated_sha256 = self._calculate_file_hash(temp_path, 'sha256')
            if calculated_sha256.lower() != sha256.lower():
                logger.error(f"SHA256 mismatch: expected {sha256}, got {calculated_sha256}")
                return False
            logger.info(f"SHA256 verification passed")
        
        if sha512:
            calculated_sha512 = self._calculate_file_hash(temp_path, 'sha512')
            if calculated_sha512.lower() != sha512.lower():
                logger.error(f"SHA512 mismatch: expected {sha512}, got {calculated_sha512}")
                return False
            logger.info(f"SHA512 verification passed")
        
        return True
    
    def _write_audit_log(self, name: str, version: str, sha256: str = None, sha512: str = None, success: bool = True):
        """Write package download and verification to audit log
        
        Args:
            name: Package name
            version: Package version
            sha256: SHA256 hash used (if any)
            sha512: SHA512 hash used (if any)
            success: Whether verification succeeded
        """
        try:
            audit_log_path = Path.home() / ".attacktrace" / "log" / "package_audit.log"
            audit_log_path.parent.mkdir(parents=True, exist_ok=True)
            
            timestamp = datetime.now().isoformat()
            status = "SUCCESS" if success else "FAILED"
            sha256_status = "verified" if sha256 else "skipped"
            sha512_status = "verified" if sha512 else "skipped"
            
            log_entry = (f"{timestamp} | {status} | DOWNLOAD | {name}@{version} | "
                        f"SHA256: {sha256_status} | SHA512: {sha512_status}\n")
            
            with open(audit_log_path, 'a', encoding='utf-8') as f:
                f.write(log_entry)
            
            logger.debug(f"Audit log written for {name}@{version}")
        except Exception as e:
            logger.warning(f"Failed to write audit log: {e}")
    
    async def download_package_with_progress(
        self, name: str, version: str, download_url: str, 
        progress_callback=None, sha256: str = None, sha512: str = None
    ) -> PackageInfo:
        """Download and extract package with progress callback
        
        Args:
            name: Package name
            version: Package version
            download_url: URL to download from
            progress_callback: Optional async callback(progress: int, message: str)
        
        Returns:
            PackageInfo object
        """
        install_dir = self.packages_dir / f"{name}@{version}"
        
        # If package already exists, return it directly
        if install_dir.exists():
            logger.info(f"Package {name}@{version} already exists at {install_dir}")
            if progress_callback:
                await progress_callback(100, "Package already exists")
            pkg = self.get_package(name, version)
            if pkg:
                return pkg
        
        logger.info(f"Downloading {name}@{version} from {download_url}...")
        if progress_callback:
            await progress_callback(5, "Starting download...")
        
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
                        last_progress = 0
                        
                        with open(temp_path, 'wb') as f:
                            async for chunk in response.aiter_bytes(chunk_size=8192):
                                f.write(chunk)
                                downloaded += len(chunk)
                                if total_size > 0:
                                    # Progress: 5-60% for download
                                    progress = int(5 + (downloaded / total_size) * 55)
                                    if progress_callback and progress > last_progress:
                                        await progress_callback(progress, f"Downloading... {downloaded // 1024}KB / {total_size // 1024}KB")
                                        last_progress = progress
                                    if downloaded % (1024 * 1024) == 0:  # Log every 1MB
                                        logger.debug(f"Download progress: {progress}%")
            
            # Verify package integrity if hash provided
            if sha256 or sha512:
                logger.info(f"Verifying package integrity...")
                if progress_callback:
                    await progress_callback(62, "Verifying package integrity...")
                
                is_valid = self._verify_package_integrity(temp_path, sha256, sha512)
                if not is_valid:
                    logger.error(f"Package integrity verification failed for {name}@{version}")
                    # Log failed verification to audit log
                    self._write_audit_log(name, version, sha256, sha512, success=False)
                    if temp_path and temp_path.exists():
                        temp_path.unlink()  # Delete corrupt file
                    raise Exception("Package integrity verification failed: hash mismatch")
                
                logger.info(f"Package integrity verified successfully")
                # Log successful verification to audit log
                self._write_audit_log(name, version, sha256, sha512, success=True)
            
            # Extract package
            logger.info(f"Extracting package to {install_dir}...")
            if progress_callback:
                await progress_callback(65, "Extracting package...")
            install_dir.mkdir(parents=True, exist_ok=True)
            
            with tarfile.open(temp_path, 'r:gz') as tar:
                # Security check: prevent path traversal attacks
                def is_within_directory(directory, target):
                    abs_directory = Path(directory).resolve()
                    abs_target = Path(target).resolve()
                    return abs_target.is_relative_to(abs_directory)
                
                members = tar.getmembers()
                total_members = len(members)
                for idx, member in enumerate(members):
                    member_path = install_dir / member.name
                    if not is_within_directory(install_dir, member_path):
                        raise Exception(f"Attempted path traversal in tar file: {member.name}")
                
                tar.extractall(install_dir)
                
                # Progress: 65-80% for extraction
                if progress_callback:
                    await progress_callback(80, "Extraction complete")
            
            logger.info(f"Package extracted successfully")
            
            # Check if node_modules already exists (pre-bundled package)
            node_modules_dir = install_dir / "node_modules"
            if node_modules_dir.exists() and node_modules_dir.is_dir():
                logger.info(f"Package includes node_modules")
            else:
                logger.warning(f"Package does not include node_modules, but npm install is disabled.")
                if progress_callback:
                     await progress_callback(95, "Warning: No node_modules found")
            
            if progress_callback:
                await progress_callback(100, "Package ready")
            
            pkg = self.get_package(name, version)
            if not pkg:
                raise Exception(f"Failed to get package info after installation")
            return pkg
            
        except Exception as e:
            logger.error(f"Failed to download/install package {name}@{version}: {e}")
            if progress_callback:
                await progress_callback(0, f"Error: {str(e)}")
            # Clean up failed installation
            if install_dir and install_dir.exists():
                try:
                    import shutil
                    shutil.rmtree(install_dir)
                    logger.info(f"Cleaned up failed installation at {install_dir}")
                except Exception as cleanup_error:
                    logger.error(f"Failed to clean up {install_dir}: {cleanup_error}")
            raise
        finally:
            # Clean up temporary file
            if temp_path and temp_path.exists():
                try:
                    temp_path.unlink()
                except Exception as e:
                    logger.warning(f"Failed to delete temporary file {temp_path}: {e}")
    
    async def download_package(
        self, name: str, version: str, download_url: str
    ) -> PackageInfo:
        """Download and extract package (backward compatibility wrapper)
        
        If package already exists, return it directly; otherwise download, extract and install dependencies
        """
        return await self.download_package_with_progress(name, version, download_url, None)
    
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
