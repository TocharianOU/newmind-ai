import { MCPPackageManager } from '../package-manager.js';
import { appDir } from '../constant.js';
import { safeRegisterHandler } from '../utils/ipcRegistry.js';

const packageManager = new MCPPackageManager(appDir);

safeRegisterHandler('mcp:install-package', async (_, { name, version, downloadUrl }) => {
  try {
    const installPath = await packageManager.downloadAndInstall(name, version, downloadUrl);
    return { success: true, installPath };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

safeRegisterHandler('mcp:is-installed', async (_, { name, version }) => {
  try {
    const isInstalled = await packageManager.isInstalled(name, version);
    return { success: true, isInstalled };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

safeRegisterHandler('mcp:get-install-path', async (_, { name, version }) => {
  try {
    const installPath = packageManager.getInstallPath(name, version);
    return { success: true, installPath };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

safeRegisterHandler('mcp:uninstall-package', async (_, { name, version }) => {
  try {
    await packageManager.uninstall(name, version);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
