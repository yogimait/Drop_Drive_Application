// purgeController.js - Predictable, safe, and testable purge handling
// Attempts purge methods in order: Crypto Erase → NVMe Sanitize → ATA Secure Erase

const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Try to load the native addon with prod-safe path resolution
let wipeAddon;
try {
    // Production: resources/native/wipeAddon.node (via extraResources)
    // Development: native/build/Release/wipeAddon.node
    const addonPath = app.isPackaged
        ? path.join(process.resourcesPath, 'native', 'wipeAddon.node')
        : path.join(__dirname, '..', 'native', 'build', 'Release', 'wipeAddon.node');

    // Verify addon file exists before loading
    if (!fs.existsSync(addonPath)) {
        throw new Error(`Native addon not found at: ${addonPath}`);
    }

    wipeAddon = require(addonPath);
    console.log('[PurgeController] Native addon loaded successfully');
} catch (error) {
    console.warn('[PurgeController] Native addon not available:', error.message);
    wipeAddon = null;
}

/**
 * Purge result structure returned by each purge attempt
 * @typedef {Object} PurgeAttemptResult
 * @property {string} method - Method name (cryptoErase, nvmeSanitize, ataSecureErase)
 * @property {boolean} supported - Whether the device supports this method
 * @property {boolean} executed - Whether the operation was actually executed (false if dryRun)
 * @property {boolean} success - Whether the operation succeeded
 * @property {string|null} error - Error message if failed
 * @property {boolean} dryRun - Whether this was a dry run
 */

/**
 * Final purge result
 * @typedef {Object} PurgeResult
 * @property {boolean} purgeSucceeded - True only if a real purge method succeeded
 * @property {string|null} successfulMethod - The method that succeeded, or null
 * @property {boolean} dryRun - Whether this was a dry run
 * @property {PurgeAttemptResult[]} attempts - All purge attempts made
 * @property {string[]} logs - Detailed logs
 * @property {Object|null} fallbackRecommendation - Recommended fallback if purge failed
 */

/**
 * Execute purge operation with ordered method attempts
 * @param {string} devicePath - The device path (e.g., \\.\PhysicalDrive1)
 * @param {Object} options - Options for purge
 * @param {boolean} [options.dryRun=false] - If true, simulate without actual execution
 * @returns {Promise<PurgeResult>}
 */
async function executePurge(devicePath, options = {}) {
    const { dryRun = false } = options;

    const logs = [];
    const attempts = [];
    let purgeSucceeded = false;
    let successfulMethod = null;

    const log = (message) => {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message}`;
        logs.push(logEntry);
        console.log(`[PurgeController] ${message}`);
    };

    log(`Starting purge on ${devicePath} (dryRun: ${dryRun})`);

    if (!wipeAddon) {
        log('ERROR: Native addon not available - cannot perform purge');
        return {
            purgeSucceeded: false,
            successfulMethod: null,
            dryRun,
            attempts: [],
            logs,
            fallbackRecommendation: {
                methods: ['clear', 'destroy'],
                reason: 'Native addon not loaded',
                message: 'Purge methods unavailable. Recommend using Clear (software wipe) or Destroy.'
            }
        };
    }

    // Method execution order: Crypto Erase → NVMe Sanitize → ATA Secure Erase
    const methodsToAttempt = [
        {
            name: 'cryptoErase',
            execute: () => wipeAddon.cryptoErase(devicePath, dryRun),
            description: 'Crypto Erase (Self-Encrypting Drive)'
        },
        {
            name: 'nvmeSanitize',
            execute: () => wipeAddon.nvmeSanitize(devicePath, 'crypto', dryRun),
            description: 'NVMe Sanitize (NVMe SSD)'
        },
        {
            name: 'ataSecureErase',
            execute: () => wipeAddon.ataSecureErase(devicePath, false, dryRun),
            description: 'ATA Secure Erase (SATA HDD/SSD)'
        }
    ];

    for (const method of methodsToAttempt) {
        log(`Attempting: ${method.description}`);

        let result;
        try {
            result = method.execute();
        } catch (error) {
            // Check if this is a privilege/permission error
            const errorMsg = error.message || '';
            const isPrivilegeError =
                errorMsg.includes('Access denied') ||
                errorMsg.includes('ACCESS_DENIED') ||
                errorMsg.includes('Error 5') ||
                errorMsg.includes('EPERM') ||
                errorMsg.includes('Operation not permitted') ||
                errorMsg.includes('requires elevation');

            if (isPrivilegeError) {
                log(`ERROR: Administrator privileges required for ${method.name}`);
                result = {
                    method: method.name,
                    supported: true, // Method might be supported, just can't access it
                    executed: false,
                    success: false,
                    error: 'Administrator permissions required. Restart DropDrive as Administrator.',
                    dryRun,
                    isPrivilegeError: true
                };
            } else {
                // Handle other unexpected errors
                log(`ERROR: Unexpected exception in ${method.name}: ${error.message}`);
                result = {
                    method: method.name,
                    supported: false,
                    executed: false,
                    success: false,
                    error: error.message,
                    dryRun
                };
            }
        }

        // Ensure result is an object (backward compatibility)
        if (typeof result === 'boolean') {
            result = {
                method: method.name,
                supported: true,
                executed: true,
                success: result,
                error: result ? null : `${method.name} returned false`,
                dryRun: false
            };
        }

        attempts.push(result);

        // Log the result
        if (!result.supported) {
            log(`  → ${method.name}: NOT SUPPORTED (expected failure, continuing)`);
            if (result.error) {
                log(`     Reason: ${result.error}`);
            }
            continue;
        }

        if (result.dryRun && !result.executed) {
            log(`  → ${method.name}: SIMULATED (dryRun mode, device supports method)`);
            // In dryRun mode, if supported, treat as "would succeed"
            purgeSucceeded = true;
            successfulMethod = method.name;
            break;
        }

        if (result.executed && result.success) {
            log(`  → ${method.name}: SUCCESS`);
            purgeSucceeded = true;
            successfulMethod = method.name;
            break;
        }

        if (result.executed && !result.success) {
            log(`  → ${method.name}: EXECUTED BUT FAILED`);
            if (result.error) {
                log(`     Error: ${result.error}`);
            }
            // Continue to next method
            continue;
        }

        // Result.supported=true but not executed and not dryRun - unexpected state
        log(`  → ${method.name}: UNEXPECTED STATE (supported=${result.supported}, executed=${result.executed})`);
    }

    // Build final result
    const finalResult = {
        purgeSucceeded,
        successfulMethod,
        dryRun,
        attempts,
        logs,
        fallbackRecommendation: null
    };

    // If all purge methods failed or were unsupported, recommend fallback
    if (!purgeSucceeded) {
        log('');
        log('⚠️  ALL PURGE METHODS FAILED OR UNSUPPORTED');
        log('');

        const allUnsupported = attempts.every(a => !a.supported);

        if (allUnsupported) {
            finalResult.fallbackRecommendation = {
                methods: ['clear', 'destroy'],
                reason: 'Device does not support any hardware purge methods',
                message: 'This device (likely a USB drive or SD card) does not support hardware-level purge commands. ' +
                    'For NIST 800-88 compliance, use: ' +
                    '1) CLEAR: Software overwrite (wipeFile) - suitable for most scenarios ' +
                    '2) DESTROY: Multi-pass overwrite with partition destruction - for highest security'
            };
            log('Recommendation: Use CLEAR (software wipe) or DESTROY method');
        } else {
            finalResult.fallbackRecommendation = {
                methods: ['clear', 'destroy'],
                reason: 'Hardware purge methods failed during execution',
                message: 'Hardware purge commands were attempted but failed. This may indicate a drive issue. ' +
                    'Recommended fallbacks: ' +
                    '1) CLEAR: Software overwrite - reliable for data destruction ' +
                    '2) DESTROY: Maximum security - use if drive is EOL or untrusted'
            };
            log('Recommendation: Purge commands failed. Use CLEAR or DESTROY method');
        }
    } else {
        if (dryRun) {
            log(`\n✅ Dry run complete. Method "${successfulMethod}" would be used for purge.`);
        } else {
            log(`\n✅ Purge completed successfully using ${successfulMethod}`);
        }
    }

    return finalResult;
}

/**
 * Check which purge methods are available for a device (non-destructive)
 * @param {string} devicePath - The device path
 * @returns {Promise<Object>} Available methods info
 */
async function checkPurgeCapabilities(devicePath) {
    // Use dryRun to check capabilities without executing
    return executePurge(devicePath, { dryRun: true });
}

/**
 * Get human-readable purge result summary
 * @param {PurgeResult} result - The purge result
 * @returns {string} Summary text
 */
function formatPurgeResult(result) {
    const lines = [];

    lines.push('=== PURGE RESULT ===');
    lines.push(`Status: ${result.purgeSucceeded ? '✅ SUCCESS' : '❌ FAILED'}`);
    lines.push(`Mode: ${result.dryRun ? 'DRY RUN (simulation)' : 'REAL EXECUTION'}`);

    if (result.successfulMethod) {
        lines.push(`Method Used: ${result.successfulMethod}`);
    }

    lines.push('');
    lines.push('--- Attempts ---');
    for (const attempt of result.attempts) {
        const status = !attempt.supported ? 'UNSUPPORTED' :
            (attempt.dryRun && !attempt.executed) ? 'SIMULATED' :
                (attempt.executed && attempt.success) ? 'SUCCESS' :
                    (attempt.executed && !attempt.success) ? 'FAILED' : 'UNKNOWN';
        lines.push(`  ${attempt.method}: ${status}`);
        if (attempt.error) {
            lines.push(`    └─ ${attempt.error}`);
        }
    }

    if (result.fallbackRecommendation) {
        lines.push('');
        lines.push('--- Fallback Recommendation ---');
        lines.push(result.fallbackRecommendation.message);
    }

    return lines.join('\n');
}

module.exports = {
    executePurge,
    checkPurgeCapabilities,
    formatPurgeResult,
    wipeAddon  // Expose for advanced usage
};
