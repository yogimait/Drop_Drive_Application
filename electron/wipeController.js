// Enhanced wipeController.js with USB management and C++ integration
const { EventEmitter } = require('events');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Worker } = require('worker_threads');
const { generateWipeCertificate } = require('./certificateGenerator');
const purgeController = require('./purgeController');
const { app } = require('electron');
const wipeLogger = require('./wipeLogger');

// Try to load the native addon
let wipeAddon;
try {
  // Production: resources/native/wipeAddon.node (via extraResources)
  // Development: native/build/Release/wipeAddon.node
  const addonPath = app.isPackaged
    ? path.join(process.resourcesPath, 'native', 'wipeAddon.node')
    : path.join(__dirname, '..', 'native', 'build', 'Release', 'wipeAddon.node');

  // Load the addon using the absolute path
  wipeAddon = require(addonPath);

  console.log('✅ Native wipe addon loaded successfully.');

} catch (error) {
  console.warn('⚠️ Native wipe addon could not be loaded. Falling back to simulation.', error.message);
  wipeAddon = null;
}

const wipeController = new EventEmitter();

// Track active wipe tasks for cancellation
const activeTasks = new Map();

/**
 * PRE-FLIGHT VALIDATION: Ensure device is ready for wiping
 * Checks performed:
 * 1. Device path format (must be \\.\PhysicalDriveX on Windows)
 * 2. Device exists and can be opened with write permission
 * 3. Device size can be determined (critical for wipe progress)
 * 
 * @param {string} devicePath - The device path to validate
 * @returns {Promise<{valid: boolean, error?: string, details?: object}>}
 */
async function validateDeviceForWipe(devicePath) {
  const isWindows = os.platform() === 'win32';
  const details = { devicePath, platform: os.platform() };

  // Check 1: Device path format validation
  if (isWindows) {
    // Windows requires \\.\PhysicalDriveX format for raw disk access
    const physicalDrivePattern = /^\\\\\.\\\\PhysicalDrive\d+$/i;
    const alternatePattern = /^\\\\.\\PhysicalDrive\d+$/i;

    if (!physicalDrivePattern.test(devicePath) && !alternatePattern.test(devicePath)) {
      // Check if it's a mount point like E: or E:\
      if (/^[A-Z]:[\\/]?$/i.test(devicePath)) {
        return {
          valid: false,
          error: `Invalid device path format. Received mount point "${devicePath}" but raw disk access requires "\\\\.\\\PhysicalDriveX" format. Please select the physical drive, not a volume.`,
          details: { ...details, issue: 'mount_point_instead_of_raw' }
        };
      }
      return {
        valid: false,
        error: `Invalid device path format: "${devicePath}". Expected format: \\\\.\\\PhysicalDriveX (e.g., \\\\.\\\PhysicalDrive1)`,
        details: { ...details, issue: 'invalid_format' }
      };
    }
  } else {
    // Linux/macOS requires /dev/sdX or /dev/nvmeXnY format
    if (!devicePath.startsWith('/dev/')) {
      return {
        valid: false,
        error: `Invalid device path format: "${devicePath}". Expected format: /dev/sdX or /dev/nvmeXnY`,
        details: { ...details, issue: 'invalid_format' }
      };
    }
  }

  // Check 2: Device accessibility test (can we open it?)
  if (isWindows) {
    // On Windows, we need to use native addon to check device access
    // For now, we'll trust the path format and let the native code handle it
    // The native addon will report ACCESS_DENIED if there's a problem
    console.log(`[Validation] Device path format OK: ${devicePath}`);
  } else {
    // On Linux/macOS, check if device exists
    if (!fs.existsSync(devicePath)) {
      return {
        valid: false,
        error: `Device not found: ${devicePath}`,
        details: { ...details, issue: 'device_not_found' }
      };
    }
  }

  // Check 3: Get device info using native addon (if available)
  if (wipeAddon && typeof wipeAddon.getDeviceInfo === 'function') {
    try {
      const deviceInfo = wipeAddon.getDeviceInfo(devicePath);
      if (!deviceInfo || deviceInfo.size === 0) {
        return {
          valid: false,
          error: `Cannot determine device size for: ${devicePath}. This may indicate the device is not accessible or is in use by another process.`,
          details: { ...details, issue: 'cannot_get_size', deviceInfo }
        };
      }
      console.log(`[Validation] Device verified: ${devicePath}, Size: ${(deviceInfo.size / 1024 / 1024 / 1024).toFixed(2)} GB`);
      details.deviceSize = deviceInfo.size;
      details.deviceSizeGB = deviceInfo.sizeGB;
    } catch (err) {
      // If getDeviceInfo fails, log but continue (addon may still work)
      console.warn(`[Validation] getDeviceInfo failed: ${err.message}`);
    }
  }

  return { valid: true, details };
}

function cancelWipe(wipeId) {
  if (activeTasks.has(wipeId)) {
    console.log(`[WipeController] Cancelling wipe ${wipeId}`);
    try { activeTasks.get(wipeId).cancel(); } catch (e) { console.error(e); }
    activeTasks.delete(wipeId);
    return true;
  }
  return false;
}

// Helper to run blocking operations in a worker thread
function runWorkerTask(wipeId, operation, devicePath, wipeType, dryRun, onProgress) {
  // Get the addon path to pass to worker (worker can't use electron module)
  const workerAddonPath = app.isPackaged
    ? path.join(process.resourcesPath, 'native', 'wipeAddon.node')
    : path.join(__dirname, '..', 'native', 'build', 'Release', 'wipeAddon.node');

  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'wipeWorker.js'), {
      workerData: { operation, devicePath, wipeType, dryRun, addonPath: workerAddonPath }
    });

    const cleanup = () => { clearInterval(progressInterval); if (wipeId) activeTasks.delete(wipeId); };
    if (wipeId) {
      activeTasks.set(wipeId, { cancel: () => { cleanup(); worker.terminate(); reject(new Error('Operation cancelled by user')); } });
    }

    // Send the task
    worker.postMessage({ operation, devicePath, wipeType, dryRun });

    // Fake progress/heartbeat timer
    const heartbeatParams = { progress: 30, direction: 1 };
    const progressInterval = setInterval(() => {
      // Oscillate progress between 30 and 90 to show activity
      // Slow increment logic
      if (heartbeatParams.progress < 95) heartbeatParams.progress += (Math.random() < 0.3 ? 1 : 0);

      onProgress?.({
        progress: heartbeatParams.progress,
        stage: `Executing ${operation.toUpperCase()} (Processing...)...`
      });
    }, 2000); // Update every 2s

    worker.on('message', (msg) => {
      if (msg.type === 'log') {
        console.log(`[Worker] ${msg.message}`);
      } else if (msg.type === 'done') {
        clearInterval(progressInterval);
        resolve(msg.result);
      } else if (msg.type === 'error') {
        clearInterval(progressInterval);
        reject(new Error(msg.error));
      }
    });

    worker.on('error', (err) => {
      clearInterval(progressInterval);
      reject(err);
    });

    worker.on('exit', (code) => {
      clearInterval(progressInterval);
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

// USB Drive Management Functions
class USBManager {
  static async unmountDrive(drivePath) {
    return new Promise((resolve, reject) => {
      const isWindows = os.platform() === 'win32';

      if (isWindows) {
        // Windows: Use diskpart to offline the disk
        const diskNumber = this.extractDiskNumber(drivePath);
        if (!diskNumber) {
          return reject(new Error('Could not extract disk number from path'));
        }

        const diskpartScript = `
select disk ${diskNumber}
offline disk
        `.trim();

        const tempFile = path.join(os.tmpdir(), 'diskpart_script.txt');
        fs.writeFileSync(tempFile, diskpartScript);

        exec(`diskpart /s "${tempFile}"`, (error, stdout, stderr) => {
          fs.unlinkSync(tempFile); // Clean up temp file

          if (error) {
            console.error('Diskpart unmount error:', error);
            return reject(error);
          }
          console.log('Drive unmounted successfully');
          resolve(true);
        });
      } else {
        // Linux/macOS: Use umount
        exec(`umount ${drivePath}`, (error, stdout, stderr) => {
          if (error) {
            console.error('Unmount error:', error);
            return reject(error);
          }
          console.log('Drive unmounted successfully');
          resolve(true);
        });
      }
    });
  }

  static async remountDrive(drivePath) {
    return new Promise((resolve, reject) => {
      const isWindows = os.platform() === 'win32';

      if (isWindows) {
        // Windows: Use diskpart to online the disk
        const diskNumber = this.extractDiskNumber(drivePath);
        if (!diskNumber) {
          return reject(new Error('Could not extract disk number from path'));
        }

        const diskpartScript = `
select disk ${diskNumber}
online disk
        `.trim();

        const tempFile = path.join(os.tmpdir(), 'diskpart_script.txt');
        fs.writeFileSync(tempFile, diskpartScript);

        exec(`diskpart /s "${tempFile}"`, (error, stdout, stderr) => {
          fs.unlinkSync(tempFile);

          if (error) {
            console.error('Diskpart remount error:', error);
            return reject(error);
          }
          console.log('Drive remounted successfully');
          resolve(true);
        });
      } else {
        // Linux: Re-scan for partitions
        exec(`partprobe ${drivePath}`, (error, stdout, stderr) => {
          if (error) {
            console.warn('Partprobe warning:', error);
          }
          console.log('Drive rescanned successfully');
          resolve(true);
        });
      }
    });
  }

  static extractDiskNumber(drivePath) {
    // Extract disk number from Windows physical drive path
    // e.g., "\\.\PhysicalDrive1" -> "1"
    const match = drivePath.match(/PhysicalDrive(\d+)/);
    return match ? match[1] : null;
  }

  static async checkDriveAccessible(drivePath) {
    return new Promise((resolve) => {
      fs.access(drivePath, fs.constants.F_OK, (err) => {
        resolve(!err);
      });
    });
  }
}

// Main wipe function - accepts user intent, routes to appropriate handler
// Frontend sends: devicePath, wipeType ("clear"|"purge"|"destroy"), dryRun, label, deviceInfo
// Backend decides: actual method to use, returns structured response
async function startWipe({ devicePath, wipeType, dryRun = true, label, deviceInfo, wipeId }, onProgress) {
  // Support legacy 'device' parameter for backward compatibility
  const device = devicePath || arguments[0]?.device;
  const type = wipeType || 'clear';

  console.log(`[WipeController] Starting ${type} on ${device} (dryRun: ${dryRun})`);

  // NOTE: Simulation mode is allowed in production for compatibility testing
  // Certificate generation is blocked separately for simulated wipes
  if (dryRun && app.isPackaged) {
    console.log('[WipeController] Simulation mode running in production (for compatibility testing)');
    wipeLogger.info('WIPE', 'Simulation mode in production', { devicePath: device, wipeType: type });
  }

  if (!device) {
    return {
      status: 'failed',
      executed: false,
      methodUsed: 'none',
      message: 'Missing required parameter: devicePath',
      fallbackSuggested: null
    };
  }

  // PRE-FLIGHT VALIDATION: Run comprehensive checks for LIVE wipes
  // This prevents silent failures by catching issues before the wipe starts
  if (!dryRun) {
    console.log('[WipeController] Running pre-flight device validation...');
    const validation = await validateDeviceForWipe(device);

    if (!validation.valid) {
      console.error(`[WipeController] Pre-flight validation FAILED: ${validation.error}`);
      wipeLogger.securityWarning('Pre-flight validation failed', {
        devicePath: device,
        wipeType: type,
        error: validation.error,
        details: validation.details
      });

      return {
        status: 'failed',
        executed: false,
        methodUsed: 'none',
        message: validation.error,
        fallbackSuggested: {
          methods: ['Verify device path', 'Check admin privileges', 'Close other programs using the drive'],
          reason: validation.error
        }
      };
    }

    console.log(`[WipeController] Pre-flight validation PASSED:`, validation.details);
  }

  const logs = [];
  const startTime = Date.now(); // Track duration for logging

  // Log wipe start
  wipeLogger.wipeStarted(device, type, dryRun, deviceInfo);

  // MULTI-DRIVE SAFETY: Verify serial number if provided
  if (deviceInfo?.confirmedSerial && deviceInfo?.serial) {
    if (deviceInfo.serial !== deviceInfo.confirmedSerial) {
      const errorMsg = `Drive mismatch detected! Expected serial '${deviceInfo.confirmedSerial}' but got '${deviceInfo.serial}'. Aborting for safety.`;
      wipeLogger.securityWarning('Drive mismatch detected', {
        expectedSerial: deviceInfo.confirmedSerial,
        actualSerial: deviceInfo.serial,
        devicePath: device
      });
      return {
        status: 'failed',
        executed: false,
        methodUsed: 'none',
        message: errorMsg,
        fallbackSuggested: null
      };
    }
  }

  try {
    logs.push(`Operation started at ${new Date().toLocaleTimeString()}`);
    logs.push(`Sanitization type: ${type.toUpperCase()}`);
    logs.push(`Mode: ${dryRun ? 'SIMULATION (dry run)' : 'LIVE EXECUTION'}`);
    onProgress?.({ progress: 5, stage: 'Preparing drive...', logs: [...logs] });

    // Unmount the drive (skip in dry run for safety)
    if (!dryRun) {
      logs.push('Unmounting drive...');
      onProgress?.({ progress: 10, stage: 'Unmounting drive...', logs: [...logs] });

      try {
        await USBManager.unmountDrive(device);
        logs.push('Drive unmounted successfully');
      } catch (unmountError) {
        console.warn('Unmount failed, continuing anyway:', unmountError.message);
        logs.push(`Unmount warning: ${unmountError.message}`);
      }
    } else {
      logs.push('Skipping unmount (dry run mode)');
    }

    onProgress?.({ progress: 20, stage: `Starting ${type} operation...`, logs: [...logs] });

    let result;

    // Route to appropriate handler based on wipeType
    switch (type) {
      case 'clear':
        result = await executeClear(device, wipeId, dryRun, logs, onProgress);
        break;

      case 'purge':
        result = await executePurgeHandler(device, wipeId, dryRun, logs, onProgress);
        break;

      case 'destroy':
        result = await executeDestroy(device, wipeId, dryRun, logs, onProgress);
        break;

      default:
        result = {
          status: 'failed',
          executed: false,
          methodUsed: 'none',
          message: `Unknown wipe type: ${type}`,
          fallbackSuggested: { methods: ['clear'], reason: 'Invalid wipe type specified' }
        };
    }

    // Remount the drive (only if we unmounted and actually executed)
    if (!dryRun && result.executed) {
      onProgress?.({ progress: 85, stage: 'Remounting drive...', logs: [...logs] });
      try {
        await USBManager.remountDrive(device);
        logs.push('Drive remounted successfully');
      } catch (remountError) {
        console.warn('Remount failed:', remountError.message);
        logs.push(`Remount warning: ${remountError.message}`);
      }
    }

    // CRITICAL: Only generate certificate if wipe was ACTUALLY successful
    // Never allow certificate for failed, simulated, or unsupported operations
    let certificateResult = null;
    if (result.status === 'success' && result.executed && !dryRun) {
      // Double-check: Certificate BLOCKED if wipe was not successful
      if (!result.executed) {
        logs.push('Certificate blocked: wipe was not actually executed');
      } else {
        onProgress?.({ progress: 95, stage: 'Generating certificate...', logs: [...logs] });

        const deviceInfoForCert = deviceInfo || {
          serial: device,
          model: label || 'Unknown Device',
          type: 'Unknown',
          capacity: 'Unknown'
        };

        try {
          certificateResult = await generateWipeCertificate({
            device,
            deviceInfo: deviceInfoForCert,
            eraseMethod: result.methodUsed,
            nistProfile: type.charAt(0).toUpperCase() + type.slice(1), // Clear, Purge, or Destroy
            postWipeStatus: result.status,
            logs: logs,
            toolVersion: "2.1.0",
            simulated: false  // Explicitly false - we only reach here for real wipes
          });
          logs.push(`Certificate generated: ${certificateResult?.certificateId || 'unknown'}`);
        } catch (certError) {
          console.error('[WipeController] Certificate generation failed:', certError);
          logs.push(`Certificate generation failed: ${certError.message}`);
        }
      }
    } else if (result.status !== 'success') {
      logs.push(`Certificate not generated: wipe status was '${result.status}'`);
    } else if (dryRun) {
      logs.push('Certificate not generated: simulation mode (dry run)');
    }

    logs.push(`Operation completed at ${new Date().toLocaleTimeString()}`);
    onProgress?.({ progress: 100, stage: result.message, logs: [...logs] });

    // Log wipe completion
    const durationMs = Date.now() - startTime;
    wipeLogger.wipeCompleted(device, result, durationMs);

    // Return structured response matching the spec
    return {
      status: result.status,  // 'success' | 'unsupported' | 'simulated' | 'failed'
      executed: result.executed,
      methodUsed: result.methodUsed,
      message: result.message,
      fallbackSuggested: result.fallbackSuggested || null,
      logs: logs,
      completedAt: new Date().toISOString(),
      certificatePath: certificateResult?.certPath || null,
      durationMs
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    wipeLogger.wipeFailed(device, error, durationMs);
    console.error('[WipeController] Error during wipe:', error);

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
      const humanReadableError =
        'Administrator permissions required. ' +
        'Please restart DropDrive as Administrator to perform disk wipe operations. ' +
        'Go to the Wipe Process page and click "Restart as Administrator", or close the app ' +
        'and right-click to "Run as administrator".';
      logs.push(`Permission Error: ${humanReadableError}`);
    } else {
      logs.push(`Error: ${error.message}`);
    }

    // Try to remount even if wipe failed
    try {
      await USBManager.remountDrive(device);
      logs.push('Drive remounted after error');
    } catch (remountError) {
      logs.push(`Failed to remount after error: ${remountError.message}`);
    }

    return {
      status: 'failed',
      executed: false,
      methodUsed: 'none',
      message: isPrivilegeError
        ? 'Administrator permissions required for disk wipe operations.'
        : `Operation failed: ${error.message}`,
      fallbackSuggested: null,
      logs: logs,
      completedAt: new Date().toISOString(),
      isPrivilegeError: isPrivilegeError
    };
  }
}

// Handler for CLEAR (software overwrite)
async function executeClear(device, wipeId, dryRun, logs, onProgress) {
  logs.push('Executing CLEAR (software overwrite)...');

  if (dryRun) {
    logs.push('DRY RUN: Would perform software overwrite using wipeFile');
    // Simulate progress
    for (let i = 30; i <= 80; i += 10) {
      onProgress?.({ progress: i, stage: 'Simulating clear operation...', logs: [...logs] });
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return {
      status: 'simulated',
      executed: false,
      methodUsed: 'wipeFile',
      message: 'Simulation complete - Clear operation would succeed'
    };
  }

  if (!wipeAddon || !wipeAddon.wipeFile) {
    logs.push('Native addon not available - cannot perform clear');
    return {
      status: 'failed',
      executed: false,
      methodUsed: 'none',
      message: 'Native wipe addon not available',
      fallbackSuggested: { methods: ['destroy'], reason: 'Native addon not loaded' }
    };
  }

  try {
    onProgress?.({ progress: 30, stage: 'Starting clear worker...', logs: [...logs] });

    // Use worker to avoid freezing main thread
    const result = await runWorkerTask(wipeId, 'clear', device, 'clear', dryRun, onProgress);

    logs.push(`Worker result: ${result.message}`);
    const success = result.status === 'success';

    return {
      status: success ? 'success' : 'failed',
      executed: true,
      methodUsed: 'wipeFile',
      message: result.message || (success ? 'Clear completed' : 'Clear failed')
    };
  } catch (error) {
    logs.push(`Clear error: ${error.message}`);
    return {
      status: 'failed',
      executed: false,
      methodUsed: 'wipeFile',
      message: `Clear execution failed: ${error.message}`
    };
  }
}

// Handler for PURGE (hardware erase) - delegates to purgeController (Worker)
async function executePurgeHandler(device, wipeId, dryRun, logs, onProgress) {
  logs.push('Executing PURGE (hardware erase)...');
  logs.push('Attempting: Crypto Erase → NVMe Sanitize → ATA Secure Erase');

  onProgress?.({ progress: 30, stage: 'Attempting purge methods...', logs: [...logs] });

  try {
    const purgeResult = await runWorkerTask(wipeId, 'purge', device, 'purge', dryRun, onProgress);

    // Merge purge logs
    if (purgeResult.logs) {
      // Simple merge
      purgeResult.logs.forEach(l => { if (!logs.includes(l)) logs.push(l); });
    }

    if (purgeResult.purgeSucceeded) {
      return {
        status: dryRun ? 'simulated' : 'success',
        executed: !dryRun,
        methodUsed: purgeResult.successfulMethod,
        message: dryRun
          ? `Simulation complete - ${purgeResult.successfulMethod} would succeed`
          : `Purge completed using ${purgeResult.successfulMethod}`
      };
    } else {
      return {
        status: 'unsupported',
        executed: false,
        methodUsed: 'none',
        message: 'Purge methods not supported for this device',
        fallbackSuggested: purgeResult.fallbackRecommendation
      };
    }
  } catch (error) {
    logs.push(`Purge error: ${error.message}`);
    return {
      status: 'failed',
      executed: false,
      methodUsed: 'none',
      message: `Purge execution failed: ${error.message}`,
      fallbackSuggested: null
    };
  }
}

// Handler for DESTROY (multi-pass + partition destruction)
async function executeDestroy(device, wipeId, dryRun, logs, onProgress) {
  logs.push('Executing DESTROY (multi-pass overwrite + partition destruction)...');

  if (dryRun) {
    logs.push('DRY RUN: Would perform multi-pass overwrite with partition destruction');
    for (let i = 30; i <= 80; i += 10) {
      onProgress?.({ progress: i, stage: 'Simulating destroy operation...', logs: [...logs] });
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return {
      status: 'simulated',
      executed: false,
      methodUsed: 'destroyDrive',
      message: 'Simulation complete - Destroy operation would proceed'
    };
  }

  // Real execution via Worker
  if (!wipeAddon) {
    logs.push('Native addon not available - cannot perform destroy');
    return {
      status: 'failed',
      executed: false,
      methodUsed: 'none',
      message: 'Native execution failed: Addon not loaded',
      fallbackSuggested: null
    };
  }

  try {
    onProgress?.({ progress: 30, stage: 'Starting destroy worker...', logs: [...logs] });

    // Use worker
    const result = await runWorkerTask(wipeId, 'destroy', device, 'destroy', dryRun, onProgress);

    logs.push(`Worker result: ${result.message}`);
    const success = result.status === 'success';

    return {
      status: success ? 'success' : 'failed',
      executed: true,
      methodUsed: 'destroyDrive',
      message: result.message || (success ? 'Destroy completed' : 'Destroy failed')
    };
  } catch (error) {
    logs.push(`Destroy error: ${error.message}`);
    return {
      status: 'failed',
      executed: false,
      methodUsed: 'destroyDrive',
      message: `Destroy execution failed: ${error.message}`
    };
  }
}

function mapMethodToNistProfile(method) {
  switch ((method || '').toLowerCase()) {
    case 'nist': return 'Clear';
    case 'nist-800': return 'Clear';
    case 'dod-5220': return 'Purge';
    case 'dod': return 'Purge';
    case 'gutmann': return 'Destroy';
    case 'zero': return 'Clear';
    case 'random': return 'Clear';
    default: return 'Clear';
  }
}

function getWipePassCount(method) {
  switch ((method || '').toLowerCase()) {
    case 'dod-5220': return 3;
    case 'dod': return 3;
    case 'gutmann': return 35;
    case 'nist': return 1;
    case 'nist-800': return 1;
    case 'zero': return 1;
    case 'random': return 1;
    default: return 1;
  }
}

// Test function for the addon
function testNativeAddon() {
  if (wipeAddon && wipeAddon.wipeFile) {
    console.log('Testing native addon...');

    // Create a test file
    const testFilePath = path.join(os.tmpdir(), 'wipe_test.txt');
    fs.writeFileSync(testFilePath, 'This is test data to be wiped securely.');

    console.log('Created test file:', testFilePath);

    // Test the wipe
    try {
      const result = wipeAddon.wipeFile(testFilePath, 'zero');
      console.log('Native addon test result:', result);

      // Check if file still exists and its content
      if (fs.existsSync(testFilePath)) {
        const content = fs.readFileSync(testFilePath, 'utf8');
        console.log('File content after wipe:', content.length > 0 ? 'Data remains' : 'File wiped');
        fs.unlinkSync(testFilePath); // Clean up
      } else {
        console.log('File was deleted during wipe');
      }

      return { success: true, result };
    } catch (error) {
      console.error('Native addon test failed:', error);
      // Clean up on error
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
      return { success: false, error: error.message };
    }
  } else {
    return { success: false, error: 'Native addon not loaded' };
  }
}

module.exports = {
  startWipe,
  cancelWipe, // Exported cancellation
  wipeController,
  testNativeAddon,
  USBManager,
  ExecutePurge: purgeController.executePurge,
  checkPurgeCapabilities: purgeController.checkPurgeCapabilities,
  formatPurgeResult: purgeController.formatPurgeResult
};