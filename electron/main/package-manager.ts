import fs from 'fs-extra';
import path from 'path';
import https from 'https';
import http from 'http';
import tar from 'tar';
import os from 'os';

export class MCPPackageManager {
  private packagesDir: string;
  
  constructor(baseDir: string) {
    this.packagesDir = path.join(baseDir, 'mcp-packages');
  }
  
  /**
   * Download and install an MCP package from a URL
   * @param name Package name (e.g., 'elasticsearch-mcp')
   * @param version Package version (e.g., '0.6.2')
   * @param downloadUrl GitHub Release download URL
   * @returns Install directory path
   */
  async downloadAndInstall(name: string, version: string, downloadUrl: string): Promise<string> {
    console.log(`📦 Installing ${name}@${version}...`);
    
    // 1. Define paths
    const tempFile = path.join(os.tmpdir(), `${name}-${version}.tar.gz`);
    const installDir = path.join(this.packagesDir, `${name}@${version}`);
    
    // 2. Check if already installed
    if (await fs.pathExists(installDir)) {
      const packageJsonPath = path.join(installDir, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        console.log(`✓ ${name}@${version} already installed`);
        return installDir;
      } else {
        // Invalid installation, remove and reinstall
        console.log(`⚠️  Invalid installation found, removing...`);
        await fs.remove(installDir);
      }
    }
    
    try {
      // 3. Download tar.gz
      console.log(`⬇️  Downloading from ${downloadUrl}...`);
      await this.downloadFile(downloadUrl, tempFile);
      console.log(`✓ Downloaded to ${tempFile}`);
      
      // 4. Extract
      console.log(`📂 Extracting to ${installDir}...`);
      await fs.ensureDir(installDir);
      await tar.extract({
        file: tempFile,
        cwd: installDir,
        strip: 0  // Keep original directory structure
      });
      console.log(`✓ Extracted successfully`);
      
      // 5. Validate installation
      const packageJsonPath = path.join(installDir, 'package.json');
      if (!await fs.pathExists(packageJsonPath)) {
        throw new Error(`Invalid package: missing package.json`);
      }
      
      // 6. Clean up temp file
      await fs.remove(tempFile);
      console.log(`✅ ${name}@${version} installed successfully to ${installDir}`);
      
      return installDir;
      
    } catch (error) {
      // Clean up on error
      await fs.remove(tempFile).catch(() => {});
      await fs.remove(installDir).catch(() => {});
      
      console.error(`❌ Failed to install ${name}@${version}:`, error);
      throw error;
    }
  }
  
  /**
   * Download a file from URL to destination
   */
  private async downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      
      const handleResponse = (response: http.IncomingMessage) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            console.log(`↪️  Redirecting to ${redirectUrl}`);
            file.close();
            fs.unlink(dest, () => {});
            this.downloadFile(redirectUrl, dest).then(resolve).catch(reject);
            return;
          }
        }
        
        if (response.statusCode !== 200) {
          file.close();
          fs.unlink(dest, () => {});
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve();
        });
        
        file.on('error', (err) => {
          file.close();
          fs.unlink(dest, () => {});
          reject(err);
        });
      };
      
      // Choose http or https based on URL
      const client = url.startsWith('https') ? https : http;
      
      const request = client.get(url, handleResponse);
      
      request.on('error', (err) => {
        file.close();
        fs.unlink(dest, () => {});
        reject(err);
      });
      
      request.setTimeout(60000, () => {
        request.destroy();
        file.close();
        fs.unlink(dest, () => {});
        reject(new Error('Download timeout'));
      });
    });
  }
  
  /**
   * Check if a package is installed
   */
  async isInstalled(name: string, version: string): Promise<boolean> {
    const installDir = path.join(this.packagesDir, `${name}@${version}`);
    const packageJsonPath = path.join(installDir, 'package.json');
    return await fs.pathExists(packageJsonPath);
  }
  
  /**
   * Get installation path for a package
   */
  getInstallPath(name: string, version: string): string {
    return path.join(this.packagesDir, `${name}@${version}`);
  }
  
  /**
   * Uninstall a package
   */
  async uninstall(name: string, version: string): Promise<void> {
    const installDir = path.join(this.packagesDir, `${name}@${version}`);
    if (await fs.pathExists(installDir)) {
      await fs.remove(installDir);
      console.log(`✓ Uninstalled ${name}@${version}`);
    }
  }
}
