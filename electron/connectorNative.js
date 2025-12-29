// connectorNative.js
const path = require('path');

// Load the native wipe addon ONLY here:
const wipeAddon = require(path.resolve(__dirname, '../native/build/Release/wipeAddon.node'));

// This is your GLUE between Electron backend (JS) and C++ addon
function wipeDeviceOrFile(device, method) {
  // Call your native function (synchronously for now)
  // You can expand to async/promise logic later if desired!
  return wipeAddon.wipeFile(device, method); // returns a string from C++
}

module.exports = {
  wipeDeviceOrFile
};
