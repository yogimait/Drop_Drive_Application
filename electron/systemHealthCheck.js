// systemHealthCheck.js - First-run self-test for production builds
const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');

/**
 * System Health Check Module
 * Performs critical checks at startup to ensure the application can function properly.
 * If any check fails, the app exits immediately with a clear error message.
 */

// Single source of truth for paths
// Production: resources/native/wipeAddon.node (via extraResources)
// Development: native/build/Release/wipeAddon.node
const getAddonPath = () => app.isPackaged
    ? path.join(process.resourcesPath, 'native', 'wipeAddon.node')
    : path.join(__dirname, '..', 'native', 'build', 'Release', 'wipeAddon.node');

const getCertDir = () => path.join(app.getPath('userData'), 'certificates');
const getLogsDir = () => path.join(app.getPath('userData'), 'logs');

/**
 * Check 1: Native Addon Load Test
 * Verifies the wipeAddon.node can be loaded and initialized
 */
function checkAddonLoad() {
    const addonPath = getAddonPath();

    // Check if file exists
    if (!fs.existsSync(addonPath)) {
        return {
            success: false,
            check: 'Native Addon',
            error: `Addon file not found at: ${addonPath}`,
            critical: true
        };
    }

    // Try to load the addon
    try {
        const addon = require(addonPath);

        // Verify essential functions exist
        if (typeof addon.wipeFile !== 'function') {
            return {
                success: false,
                check: 'Native Addon',
                error: 'Addon loaded but wipeFile function is missing',
                critical: true
            };
        }

        return {
            success: true,
            check: 'Native Addon',
            message: `Loaded successfully from: ${addonPath}`
        };
    } catch (error) {
        // Check for ABI mismatch (common issue)
        const isAbiMismatch = error.message.includes('Module did not self-register') ||
            error.message.includes('was compiled against a different Node.js version');

        return {
            success: false,
            check: 'Native Addon',
            error: isAbiMismatch
                ? `Addon architecture mismatch. Rebuild with: node-gyp rebuild --target=<electron_version> --arch=x64 --dist-url=https://electronjs.org/headers`
                : `Failed to load addon: ${error.message}`,
            critical: true
        };
    }
}

/**
 * Check 2: Admin/Elevated Permissions (Windows)
 * Verifies the app has administrator privileges
 */
function checkAdminRights() {
    if (process.platform !== 'win32') {
        return {
            success: true,
            check: 'Admin Rights',
            message: 'Non-Windows platform, skipping admin check'
        };
    }

    try {
        // Try to access a system-level operation indicator
        const isElevated = require('./adminUtils').checkElevation();

        if (!isElevated) {
            return {
                success: false,
                check: 'Admin Rights',
                error: 'Application is not running with Administrator privileges. Disk wipe operations will fail.',
                critical: false, // Not critical for startup, but will affect functionality
                warning: true
            };
        }

        return {
            success: true,
            check: 'Admin Rights',
            message: 'Running with Administrator privileges'
        };
    } catch (error) {
        return {
            success: false,
            check: 'Admin Rights',
            error: `Failed to check elevation status: ${error.message}`,
            critical: false,
            warning: true
        };
    }
}

/**
 * Check 3: Certificate Directory Writable
 * Verifies certificates can be written to disk
 */
function checkCertDirWritable() {
    const certDir = getCertDir();

    try {
        // Create directory if it doesn't exist
        if (!fs.existsSync(certDir)) {
            fs.mkdirSync(certDir, { recursive: true });
        }

        // Test write permissions by creating and deleting a test file
        const testFile = path.join(certDir, '.write_test');
        fs.writeFileSync(testFile, 'test', 'utf8');
        fs.unlinkSync(testFile);

        return {
            success: true,
            check: 'Certificate Directory',
            message: `Writable at: ${certDir}`
        };
    } catch (error) {
        return {
            success: false,
            check: 'Certificate Directory',
            error: `Cannot write to certificate directory: ${error.message}`,
            critical: true
        };
    }
}

/**
 * Check 4: Logs Directory Writable
 * Verifies logs can be written to disk
 */
function checkLogsDirWritable() {
    const logsDir = getLogsDir();

    try {
        // Create directory if it doesn't exist
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        // Test write permissions
        const testFile = path.join(logsDir, '.write_test');
        fs.writeFileSync(testFile, 'test', 'utf8');
        fs.unlinkSync(testFile);

        return {
            success: true,
            check: 'Logs Directory',
            message: `Writable at: ${logsDir}`
        };
    } catch (error) {
        return {
            success: false,
            check: 'Logs Directory',
            error: `Cannot write to logs directory: ${error.message}`,
            critical: false, // Logs are important but not critical
            warning: true
        };
    }
}

/**
 * Run all system health checks
 * @returns {Object} Results of all checks
 */
function runAllChecks() {
    console.log('[HealthCheck] Starting system health verification...');

    const results = {
        timestamp: new Date().toISOString(),
        isPackaged: app.isPackaged,
        platform: process.platform,
        checks: []
    };

    // Run all checks
    results.checks.push(checkAddonLoad());
    results.checks.push(checkAdminRights());
    results.checks.push(checkCertDirWritable());
    results.checks.push(checkLogsDirWritable());

    // Analyze results
    const criticalFailures = results.checks.filter(c => !c.success && c.critical);
    const warnings = results.checks.filter(c => !c.success && c.warning);
    const passed = results.checks.filter(c => c.success);

    results.summary = {
        totalChecks: results.checks.length,
        passed: passed.length,
        warnings: warnings.length,
        criticalFailures: criticalFailures.length,
        overallStatus: criticalFailures.length === 0 ? 'PASS' : 'FAIL'
    };

    // Log results
    console.log('[HealthCheck] Results:');
    results.checks.forEach(check => {
        const status = check.success ? '✅' : (check.critical ? '❌' : '⚠️');
        console.log(`  ${status} ${check.check}: ${check.success ? check.message : check.error}`);
    });
    console.log(`[HealthCheck] Overall: ${results.summary.overallStatus}`);

    return results;
}

/**
 * Perform system health check with UI feedback
 * Shows error dialog and exits if critical failures are detected
 * @param {boolean} exitOnFailure - Whether to exit the app on critical failure
 */
function performHealthCheck(exitOnFailure = true) {
    const results = runAllChecks();

    if (results.summary.criticalFailures > 0 && app.isPackaged) {
        const criticalErrors = results.checks
            .filter(c => !c.success && c.critical)
            .map(c => `• ${c.check}: ${c.error}`)
            .join('\n\n');

        dialog.showErrorBox(
            'System Health Check Failed',
            `DropDrive cannot start due to critical issues:\n\n${criticalErrors}\n\nThe application will now exit.`
        );

        if (exitOnFailure) {
            app.quit();
        }

        return { success: false, results };
    }

    // Log warnings for non-critical issues
    if (results.summary.warnings > 0) {
        const warningMessages = results.checks
            .filter(c => !c.success && c.warning)
            .map(c => `${c.check}: ${c.error}`)
            .join('; ');

        console.warn(`[HealthCheck] Warnings: ${warningMessages}`);
    }

    return { success: true, results };
}

module.exports = {
    runAllChecks,
    performHealthCheck,
    checkAddonLoad,
    checkAdminRights,
    checkCertDirWritable,
    checkLogsDirWritable,
    getAddonPath,
    getCertDir,
    getLogsDir
};
