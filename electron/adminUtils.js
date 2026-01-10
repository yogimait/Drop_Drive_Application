// adminUtils.js - Windows Administrator privilege detection and elevation handling
// For DropDrive disk wipe operations

const { execSync, spawn } = require('child_process');
const { app } = require('electron');

/**
 * Check if the current process is running with Administrator privileges.
 * Uses 'net session' command which only succeeds when elevated.
 * @returns {boolean} True if running as Administrator
 */
function checkElevation() {
    try {
        // 'net session' returns exit code 0 only if running with admin privileges
        execSync('net session', {
            stdio: 'pipe',
            windowsHide: true
        });
        return true;
    } catch (error) {
        // Exit code != 0 means not elevated
        return false;
    }
}

/**
 * Get detailed elevation status for UI display
 * @param {boolean} isElevated - Current elevation state
 * @returns {Object} Elevation status object
 */
function getElevationStatus(isElevated) {
    return {
        isElevated: isElevated,
        message: isElevated
            ? 'Running with Administrator privileges'
            : 'Administrator permissions are required for disk wipe operations.',
        guidance: isElevated ? null : [
            'Disk wipe operations write directly to physical drives.',
            'Windows requires Administrator privileges for this level of access.',
            'Click "Restart as Administrator" to enable full functionality.',
            'Alternatively, close the app and restart it as Administrator manually.'
        ],
        capabilities: {
            canWipe: isElevated,
            canPurge: isElevated,
            canTestAddon: true,  // Testing doesn't require admin
            canDryRun: true,     // Dry run should work without admin
            canViewDrives: true  // Reading drive info doesn't require admin
        }
    };
}

/**
 * Restart the application with Administrator privileges.
 * Shows UAC prompt on Windows.
 * @returns {Object} Result of the elevation attempt
 */
function restartWithElevation() {
    try {
        const appPath = process.execPath;
        const isPackaged = app.isPackaged;
        let args = [];

        if (!isPackaged) {
            // In dev mode, we need to pass the script path
            // process.argv[1] is usually the app path/script
            // Use absolute path for safety if it is '.'
            let scriptPath = process.argv[1];
            if (scriptPath === '.') {
                scriptPath = process.cwd();
            }
            args.push(scriptPath);
            args.push(...process.argv.slice(2));
        } else {
            args = process.argv.slice(1);
        }

        console.log(`[AdminUtils] Restarting: ${appPath} with args:`, args);

        // Escape arguments for PowerShell
        // Wrap each argument in quotes and escape existing quotes with backtick
        // Note: For Start-Process -ArgumentList, we need a single string where arguments are space-separated
        // properly quoted.
        const escapedArgs = args.map(arg => {
            // Escape double quotes
            return `\\"${arg.replace(/"/g, '\\"')}\\"`;
        }).join(' ');

        // Use Start-Process with -Verb RunAs
        // We handle quoting carefully here.
        // The outer quotes for ArgumentList are single quotes to protect the double quotes inside.
        const psCommand = `Start-Process -FilePath "${appPath}" -ArgumentList ${escapedArgs ? `'${escapedArgs}'` : "''"} -WorkingDirectory "${process.cwd()}" -Verb RunAs`;

        console.log(`[AdminUtils] Executing PS Command: ${psCommand}`);

        spawn('powershell.exe', ['-Command', psCommand], {
            detached: true,
            stdio: 'ignore',
            windowsHide: false // Don't hide window to ensure UAC is visible/debuggable
        });

        // Quit the current (non-elevated) instance
        // Give it a moment to spawn the process
        setTimeout(() => {
            console.log('[AdminUtils] Quitting app...');
            app.quit();
        }, 1000);

        return {
            success: true,
            message: 'Restarting with Administrator privileges...'
        };
    } catch (error) {
        console.error('[AdminUtils] Failed to restart with elevation:', error);
        return {
            success: false,
            error: error.message,
            message: 'Failed to restart with Administrator privileges. Please restart the app manually as Administrator.'
        };
    }
}

/**
 * Check if a specific error is related to missing privileges
 * @param {Error|string} error - The error to check
 * @returns {boolean} True if this is a privilege-related error
 */
function isPrivilegeError(error) {
    const errorMessage = typeof error === 'string' ? error : (error?.message || '');
    const privilegePatterns = [
        'Access denied',
        'ACCESS_DENIED',
        'Error 5',
        'EPERM',
        'Operation not permitted',
        'requires elevation',
        'administrator privileges',
        'elevated privileges'
    ];

    return privilegePatterns.some(pattern =>
        errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
}

/**
 * Get a human-readable error message for privilege errors
 * @param {Error|string} originalError - The original error
 * @returns {string} Human-readable error message
 */
function getPrivilegeErrorMessage(originalError) {
    return 'Administrator permissions are required for this operation. ' +
        'Please restart DropDrive as Administrator to perform disk wipe operations. ' +
        'Go to the dashboard and click "Restart as Administrator", or close the app ' +
        'and right-click to "Run as administrator".';
}

module.exports = {
    checkElevation,
    getElevationStatus,
    restartWithElevation,
    isPrivilegeError,
    getPrivilegeErrorMessage
};
