const { parentPort } = require('worker_threads');
const path = require('path');

// Load the native C++ addon inside the worker
let wipeAddon;
try {
  const addonPath = path.join(__dirname, '..', 'native', 'build', 'Release', 'wipeAddon.node');
  wipeAddon = require(addonPath);
} catch (error) {
  // If the addon fails to load, post an error back to the main thread
  parentPort.postMessage({ type: 'error', error: 'Native addon could not be loaded in worker.' });
  return;
}

// Listen for messages from the main thread
parentPort.on('message', (params) => {
  const { device, method } = params;

  try {
    console.log(`[Worker] Starting wipe on ${device} with method ${method}`);
    
    // This is the blocking call. It will freeze this worker thread, but not the main app.
    const result = wipeAddon.wipeFile(device, method);
    
    // When done, post the result back to the main thread
    parentPort.postMessage({ type: 'completed', result });

  } catch (error) {
    // If an error occurs during the wipe, post it back
    parentPort.postMessage({ type: 'error', error: error.message });
  }
});