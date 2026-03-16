/**
 * afterPack hook: removes LICENSES.chromium.html from the packaged app.
 *
 * This file is injected by Electron/Chromium and contains URLs that can
 * trigger false positives in enterprise security scanners (e.g. VMRay).
 * The file is a license reference document only — the app does not access
 * any of the URLs it contains at runtime.
 */
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  const { appOutDir, packager } = context;
  const platform = packager.platform.name; // 'mac', 'windows', 'linux'

  let chromiumLicensePath;

  if (platform === 'mac') {
    const appName = packager.appInfo.productFilename;
    chromiumLicensePath = path.join(
      appOutDir,
      `${appName}.app`,
      'Contents',
      'Frameworks',
      'Electron Framework.framework',
      'Versions',
      'A',
      'Resources',
      'LICENSES.chromium.html'
    );
  } else if (platform === 'windows') {
    chromiumLicensePath = path.join(appOutDir, 'LICENSES.chromium.html');
  } else {
    chromiumLicensePath = path.join(appOutDir, 'LICENSES.chromium.html');
  }

  if (fs.existsSync(chromiumLicensePath)) {
    fs.rmSync(chromiumLicensePath);
    console.log(`[afterPack] Removed ${chromiumLicensePath}`);
  } else {
    console.log(`[afterPack] LICENSES.chromium.html not found at expected path, skipping.`);
    console.log(`[afterPack]   Looked in: ${chromiumLicensePath}`);
  }
};
