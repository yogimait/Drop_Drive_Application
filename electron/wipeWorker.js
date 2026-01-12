// wipeWorker.js - Worker thread for blocking wipe operations
// CRITICAL: Worker threads CANNOT use 'electron' module - all paths must come from workerData
const { parentPort, workerData } = require('worker_threads');
const path = require('path');
const fs = require('fs');

// Log helper to send logs back to main process
const log = (message) => {
    if (parentPort) parentPort.postMessage({ type: 'log', message });
};

// Get addon path from workerData (passed from main process)
// This is required because `electron` module is NOT available in workers
const { addonPath } = workerData || {};

// Load native addon using path from main process
let wipeAddon = null;
if (addonPath) {
    try {
        // Verify file exists before loading
        if (!fs.existsSync(addonPath)) {
            throw new Error(`Addon file not found at: ${addonPath}`);
        }
        wipeAddon = require(addonPath);
        log(`Native addon loaded from: ${addonPath}`);
    } catch (error) {
        if (parentPort) {
            parentPort.postMessage({
                type: 'error',
                error: `Failed to load native addon in worker: ${error.message}`
            });
        }
    }
} else {
    if (parentPort) {
        parentPort.postMessage({
            type: 'error',
            error: 'Worker failed to initialize: addonPath not provided in workerData'
        });
    }
}

// Main worker logic - handle wipe operations
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
                        result = "Simulation: Clear operation successful";
                        parentPort.postMessage({ type: 'done', result: { status: 'simulated', message: result } });
                    } else {
                        log(`Calling native wipeFile on: ${devicePath}`);
                        result = wipeAddon.wipeFile(devicePath, 'zero', true);
                        log(`Native wipeFile returned: ${result}`);

                        // CRITICAL: Check if addon reported failure
                        const isSuccess = result && !result.toLowerCase().includes('fail');
                        parentPort.postMessage({
                            type: 'done',
                            result: {
                                status: isSuccess ? 'success' : 'failed',
                                message: result,
                                executed: true
                            }
                        });
                    }
                    break;

                case 'destroy':
                    // destroyDrive(path, confirm)
                    if (dryRun) {
                        result = true;
                        parentPort.postMessage({ type: 'done', result: { status: 'simulated', message: 'Simulation: Destroy would execute' } });
                    } else {
                        log(`Calling native destroyDrive on: ${devicePath}`);
                        result = wipeAddon.destroyDrive(devicePath, true);
                        log(`Native destroyDrive returned: ${result}`);
                        parentPort.postMessage({ type: 'done', result: { status: result ? 'success' : 'failed', message: result ? 'Destroy executed' : 'Destroy failed', executed: true } });
                    }
                    break;

                case 'purge':
                    // Purge operations require electron (purgeController uses app module)
                    // They must be handled via direct addon calls here
                    if (dryRun) {
                        // Simulate purge - check if methods exist
                        const hasCryptoErase = typeof wipeAddon.cryptoErase === 'function';
                        const hasNvmeSanitize = typeof wipeAddon.nvmeSanitize === 'function';
                        const hasAtaSecureErase = typeof wipeAddon.ataSecureErase === 'function';

                        if (hasCryptoErase || hasNvmeSanitize || hasAtaSecureErase) {
                            parentPort.postMessage({
                                type: 'done',
                                result: {
                                    purgeSucceeded: true,
                                    successfulMethod: hasCryptoErase ? 'cryptoErase' : (hasNvmeSanitize ? 'nvmeSanitize' : 'ataSecureErase'),
                                    dryRun: true,
                                    logs: ['Dry run: Purge methods available']
                                }
                            });
                        } else {
                            parentPort.postMessage({
                                type: 'done',
                                result: {
                                    purgeSucceeded: false,
                                    successfulMethod: null,
                                    dryRun: true,
                                    fallbackRecommendation: { methods: ['clear', 'destroy'], reason: 'No purge methods available' }
                                }
                            });
                        }
                    } else {
                        // Try purge methods in order: Crypto Erase → NVMe Sanitize → ATA Secure Erase
                        let purgeSucceeded = false;
                        let successfulMethod = null;
                        const logs = [];

                        // Try Crypto Erase
                        if (typeof wipeAddon.cryptoErase === 'function') {
                            try {
                                log('Attempting Crypto Erase...');
                                const cryptoResult = wipeAddon.cryptoErase(devicePath, false);
                                if (cryptoResult && cryptoResult.success) {
                                    purgeSucceeded = true;
                                    successfulMethod = 'cryptoErase';
                                    logs.push('Crypto Erase succeeded');
                                }
                            } catch (e) {
                                logs.push(`Crypto Erase failed: ${e.message}`);
                            }
                        }

                        // Try NVMe Sanitize if Crypto Erase failed
                        if (!purgeSucceeded && typeof wipeAddon.nvmeSanitize === 'function') {
                            try {
                                log('Attempting NVMe Sanitize...');
                                const nvmeResult = wipeAddon.nvmeSanitize(devicePath, 'crypto', false);
                                if (nvmeResult && nvmeResult.success) {
                                    purgeSucceeded = true;
                                    successfulMethod = 'nvmeSanitize';
                                    logs.push('NVMe Sanitize succeeded');
                                }
                            } catch (e) {
                                logs.push(`NVMe Sanitize failed: ${e.message}`);
                            }
                        }

                        // Try ATA Secure Erase if others failed
                        if (!purgeSucceeded && typeof wipeAddon.ataSecureErase === 'function') {
                            try {
                                log('Attempting ATA Secure Erase...');
                                const ataResult = wipeAddon.ataSecureErase(devicePath, false, false);
                                if (ataResult && ataResult.success) {
                                    purgeSucceeded = true;
                                    successfulMethod = 'ataSecureErase';
                                    logs.push('ATA Secure Erase succeeded');
                                }
                            } catch (e) {
                                logs.push(`ATA Secure Erase failed: ${e.message}`);
                            }
                        }

                        parentPort.postMessage({
                            type: 'done',
                            result: {
                                purgeSucceeded,
                                successfulMethod,
                                dryRun: false,
                                logs,
                                fallbackRecommendation: purgeSucceeded ? null : { methods: ['clear', 'destroy'], reason: 'All purge methods failed' }
                            }
                        });
                    }
                    break;

                default:
                    throw new Error(`Unknown operation: ${operation}`);
            }

        } catch (error) {
            parentPort.postMessage({ type: 'error', error: error.message });
        }
    });
} else if (parentPort && !wipeAddon) {
    // Addon failed to load - send error
    parentPort.postMessage({ type: 'error', error: 'Worker failed to initialize: Native addon not loaded' });
}
