const { parentPort, workerData } = require('worker_threads');
const path = require('path');

// Log helper to send logs back to main process
const log = (message) => {
    if (parentPort) parentPort.postMessage({ type: 'log', message });
};

// Load native addon
let wipeAddon = null;
try {
    const addonPath = path.join(__dirname, '..', 'native', 'build', 'Release', 'wipeAddon.node');
    wipeAddon = require(addonPath);
} catch (error) {
    if (parentPort) {
        parentPort.postMessage({
            type: 'error',
            error: `Failed to load native addon in worker: ${error.message}`
        });
    }
}

// Load purge controller for purge operations
let purgeController = null;
try {
    purgeController = require('./purgeController');
} catch (error) {
    log(`Warning: Failed to load purgeController in worker: ${error.message}`);
}

// Main worker logic
if (parentPort && wipeAddon) {
    parentPort.on('message', async (task) => {
        try {
            const { operation, devicePath, wipeType, dryRun } = task;

            log(`Worker starting ${operation} on ${devicePath} (DryRun: ${dryRun})`);

            let result;

            switch (operation) {
                case 'clear':
                    // wipeFile(path, method, confirm)
                    // method is usually 'zero' or 'random' for clear. 'zero' is standard.
                    if (dryRun) {
                        // Dry run should be handled by controller if possible, but if passed here:
                        result = "Simulation: Clear operation successful";
                    } else {
                        result = wipeAddon.wipeFile(devicePath, 'zero', true);
                    }
                    parentPort.postMessage({ type: 'done', result: { status: 'success', message: result } });
                    break;

                case 'destroy':
                    // destroyDrive(path, confirm)
                    if (dryRun) {
                        result = true;
                    } else {
                        result = wipeAddon.destroyDrive(devicePath, true);
                    }
                    parentPort.postMessage({ type: 'done', result: { status: result ? 'success' : 'failed', message: result ? 'Destroy executed' : 'Destroy failed' } });
                    break;

                case 'purge':
                    if (!purgeController) throw new Error('PurgeController not loaded');

                    // executePurge is async but calling synchronous native methods internally
                    // In worker, we can await it.
                    const purgeResult = await purgeController.executePurge(devicePath, { dryRun });
                    parentPort.postMessage({ type: 'done', result: purgeResult });
                    break;

                default:
                    throw new Error(`Unknown operation: ${operation}`);
            }

        } catch (error) {
            parentPort.postMessage({ type: 'error', error: error.message });
        }
    });
} else {
    // If we can't load addon, we can't do anything
    if (parentPort) parentPort.postMessage({ type: 'error', error: 'Worker failed to initialize: Addon not loaded' });
}
