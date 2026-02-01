import { ipcMain } from 'electron';
import { MCPPackageManager } from '../package-manager.js';
import { appDir } from '../constant.js';

const packageManager = new MCPPackageManager(appDir);

// Install MCP package
ipcMain.handle('mcp:install-package', async (_, { name, version, downloadUrl }) => {
  try {
    const installPath = await packageManager.downloadAndInstall(name, version, downloadUrl);
    return { success: true, installPath };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Check if package is installed
ipcMain.handle('mcp:is-installed', async (_, { name, version }) => {
  try {
    const isInstalled = await packageManager.isInstalled(name, version);
    return { success: true, isInstalled };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Get package install path
ipcMain.handle('mcp:get-install-path', async (_, { name, version }) => {
  try {
    const installPath = packageManager.getInstallPath(name, version);
    return { success: true, installPath };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Uninstall package
ipcMain.handle('mcp:uninstall-package', async (_, { name, version }) => {
  try {
    await packageManager.uninstall(name, version);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
