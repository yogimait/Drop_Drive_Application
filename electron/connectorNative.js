// connectorNative.js
const path = require('path');
const fs = require('fs');
const { app, dialog } = require('electron');

// Determine correct path for native addon
// Production: resources/native/wipeAddon.node (via extraResources)
// Development: native/build/Release/wipeAddon.node
const addonPath = app.isPackaged
  ? path.join(process.resourcesPath, 'native', 'wipeAddon.node')
  : path.join(__dirname, '..', 'native', 'build', 'Release', 'wipeAddon.node');

// CRITICAL: Hard exit if addon is missing - application cannot perform secure wipe without it
if (!fs.existsSync(addonPath)) {
  // In production, show error dialog and quit
  if (app.isPackaged) {
    dialog.showErrorBox(
      'Critical Error',
      `Native wipe engine missing.\n\nApplication cannot perform secure wipe.\n\nExpected path: ${addonPath}`
    );
    app.quit();
  }
  throw new Error(`Native wipe addon not available at: ${addonPath}`);
}

// Load the native wipe addon
const wipeAddon = require(addonPath);
console.log(`[Native] wipeAddon loaded from: ${addonPath}`);

// This is your GLUE between Electron backend (JS) and C++ addon
function wipeDeviceOrFile(device, method) {
  // Call your native function (synchronously for now)
  // You can expand to async/promise logic later if desired!
  return wipeAddon.wipeFile(device, method); // returns a string from C++
}

module.exports = {
  wipeDeviceOrFile,
  addonPath // Export for logging purposes
};

