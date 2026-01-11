const { app, BrowserWindow, ipcMain } = require('electron');
const { listDrives } = require('./deviceManager');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';
const os = require('os');
const si = require('systeminformation');
const { startWipe, cancelWipe, testNativeAddon, executePurge, checkPurgeCapabilities, formatPurgeResult } = require('./wipeController');
const { generateWipeCertificate } = require('./certificateGenerator');
const { checkElevation, getElevationStatus, restartWithElevation } = require('./adminUtils');
const fs = require('fs');
const { initializeDatabase, getAllCertificates, getCertificateById, closeDatabase } = require('./db/database');

// Global admin state - checked once at startup
let isAppElevated = false;

// Global variable to track active wipe operations
const activeWipes = new Map();
const addonPath = path.join(__dirname, '..', 'native', 'build', 'Release', 'wipeAddon.node');
// Use systeminformation for more accurate info
ipcMain.handle('get-system-info', async () => {
  const cpu = await si.cpu();
  const mem = await si.mem();
  const osInfo = await si.osInfo();
  const disks = await si.diskLayout();
  return {
    cpu: cpu.manufacturer + ' ' + cpu.brand,
    memory: Math.round(mem.total / (1024 ** 3)) + ' GB',
    os: osInfo.distro + ' ' + osInfo.arch,
    storage: disks.map(disk =>
      ({ type: disk.type, size: disk.size, name: disk.name })
    ),
  };
});

// Get file system volumes
ipcMain.handle('get-volumes', async () => {
  const fs = await si.fsSize();
  return fs.filter(volume => /^[A-Z]:/.test(volume.mount));
});

// List all available drives
ipcMain.handle('list-drives', async () => {
  return await listDrives();
});

// Test native C++ addon
ipcMain.handle('test-addon', async () => {
  try {
    // Check if the addon file actually exists before trying to load it
    if (!fs.existsSync(addonPath)) {
      throw new Error('Native addon file not found at: ' + addonPath);
    }

    // Load the addon using the absolute path
    const addon = require(addonPath);

    // --- Your test logic from test-addon.js goes here ---
    const testFile = path.join(__dirname, 'test-wipe.txt');
    fs.writeFileSync(testFile, 'This is test data to be wiped');

    const result = addon.wipeFile(testFile, 'zero');

    // Cleanup
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }

    return { success: true, result: result };

  } catch (error) {
    console.error('Addon test failed:', error);
    return { success: false, error: error.message };
  }
  return testNativeAddon();
});

// Start wipe operation
// Accepts: devicePath, wipeType ("clear"|"purge"|"destroy"), dryRun, label, deviceInfo
ipcMain.handle('start-wipe', async (event, wipeParams) => {
  const { devicePath, wipeType, dryRun, label, deviceInfo } = wipeParams;
  const wipeId = `wipe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  console.log(`[Main] Starting wipe operation ${wipeId}:`, { devicePath, wipeType, dryRun });

  try {
    // Progress callback to send updates to renderer
    const onProgress = (progressData) => {
      console.log(`[Main] Wipe progress ${wipeId}:`, progressData);
      event.sender.send('wipe-progress', {
        wipeId,
        ...progressData
      });
    };

    // Store the wipe operation
    activeWipes.set(wipeId, {
      devicePath,
      wipeType,
      dryRun,
      label,
      startedAt: new Date().toISOString(),
      status: 'running'
    });

    // Send initial status
    event.sender.send('wipe-started', { wipeId, devicePath, wipeType, dryRun, label });

    // Start the wipe operation
    const result = await startWipe({ devicePath, wipeType, dryRun, label, deviceInfo, wipeId }, onProgress);

    // Determine overall success from structured response
    const isSuccess = result.status === 'success' || result.status === 'simulated';

    // Update stored operation
    activeWipes.set(wipeId, {
      ...activeWipes.get(wipeId),
      status: result.status,
      completedAt: result.completedAt,
      certificatePath: result.certificatePath,
      pdfPath: result.pdfPath,
      methodUsed: result.methodUsed
    });

    // Send completion or appropriate status
    if (isSuccess) {
      event.sender.send('wipe-completed', {
        wipeId,
        result
      });
      console.log(`[Main] Wipe operation ${wipeId} completed: ${result.status}`);
    } else {
      // Still send as completed but with the actual status
      event.sender.send('wipe-completed', {
        wipeId,
        result
      });
      console.log(`[Main] Wipe operation ${wipeId} finished with status: ${result.status}`);
    }

    return { success: isSuccess, wipeId, result };

  } catch (error) {
    console.error(`[Main] Wipe operation ${wipeId} failed:`, error);

    // Update stored operation with error
    activeWipes.set(wipeId, {
      ...activeWipes.get(wipeId),
      status: 'failed',
      error: error.message,
      completedAt: new Date().toISOString()
    });

    // Send error status
    event.sender.send('wipe-error', {
      wipeId,
      error: error.message
    });

    return {
      success: false,
      wipeId,
      result: {
        status: 'failed',
        executed: false,
        methodUsed: 'none',
        message: error.message,
        fallbackSuggested: null
      }
    };
  }
});

// Execute NIST 800-88 Purge operation (hardware-level commands)
ipcMain.handle('execute-purge', async (event, { devicePath, options }) => {
  console.log(`[Main] Starting purge on ${devicePath}`, options);

  try {
    const result = await executePurge(devicePath, {
      dryRun: options?.dryRun ?? false
    });

    // Send progress updates if needed
    if (result.logs && result.logs.length > 0) {
      event.sender.send('purge-progress', {
        devicePath,
        logs: result.logs,
        status: result.purgeSucceeded ? 'success' : 'failed'
      });
    }

    return {
      success: true,
      result: {
        purgeSucceeded: result.purgeSucceeded,
        successfulMethod: result.successfulMethod,
        dryRun: result.dryRun,
        attempts: result.attempts,
        fallbackRecommendation: result.fallbackRecommendation,
        formattedSummary: formatPurgeResult(result)
      }
    };
  } catch (error) {
    console.error(`[Main] Purge failed on ${devicePath}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Check purge capabilities for a device (non-destructive probe)
ipcMain.handle('check-purge-capabilities', async (event, devicePath) => {
  console.log(`[Main] Checking purge capabilities for ${devicePath}`);

  try {
    const result = await checkPurgeCapabilities(devicePath);

    return {
      success: true,
      capabilities: {
        supportsPurge: result.purgeSucceeded,
        supportedMethod: result.successfulMethod,
        attempts: result.attempts,
        recommendation: result.fallbackRecommendation
      }
    };
  } catch (error) {
    console.error(`[Main] Capability check failed for ${devicePath}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Get status of active wipe operations
ipcMain.handle('get-wipe-status', async (event, wipeId) => {
  if (wipeId) {
    return activeWipes.get(wipeId) || null;
  }
  // Return all active wipes
  return Object.fromEntries(activeWipes);
});

// Stop/cancel a wipe operation
ipcMain.handle('stop-wipe', async (event, wipeId) => {
  const wipeOperation = activeWipes.get(wipeId);
  if (!wipeOperation) {
    return { success: false, error: 'Wipe operation not found' };
  }

  if (wipeOperation.status === 'running') {
    // Attempt to cancel the running task in wipeController
    if (cancelWipe) {
      cancelWipe(wipeId);
    }

    // Mark as cancelled in main process state
    activeWipes.set(wipeId, {
      ...wipeOperation,
      status: 'cancelled',
      completedAt: new Date().toISOString()
    });

    event.sender.send('wipe-cancelled', { wipeId });
    return { success: true, wipeId };
  }

  return { success: false, error: 'Wipe operation is not running' };
});

// Clean up old wipe operations (call periodically or on app shutdown)
ipcMain.handle('cleanup-wipe-history', async () => {
  const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

  for (const [wipeId, operation] of activeWipes.entries()) {
    const operationTime = new Date(operation.startedAt).getTime();
    if (operationTime < cutoffTime && operation.status !== 'running') {
      activeWipes.delete(wipeId);
    }
  }

  return { success: true, remainingOperations: activeWipes.size };
});

// Generate certificate manually (existing functionality)
ipcMain.handle('generate-certificate', async (event, data) => {
  try {
    const result = await generateWipeCertificate(data);
    return { success: true, ...result };
  } catch (error) {
    console.error("Failed to generate certificate:", error);
    return { success: false, error: error.message };
  }
});

// Get all certificates from SQLite database
ipcMain.handle('get-certificates', async () => {
  try {
    const dbCertificates = getAllCertificates();

    // Transform DB records to match the frontend expected format
    return dbCertificates.map(cert => ({
      certificate_id: cert.id,
      timestamp_utc: cert.created_at,
      device_info: {
        model: cert.device_model || 'Unknown',
        type: cert.device_type || 'Unknown',
        capacity: cert.device_size || 'Unknown',
        serial_number: cert.device_serial || 'Unknown'
      },
      erase_method: cert.erase_method || 'Unknown',
      nist_profile: cert.wipe_type,
      post_wipe_status: cert.status,
      json_path: cert.json_path,
      pdf_path: cert.pdf_path,
      simulated: cert.simulated === 1
    }));
  } catch (error) {
    console.error('[Main] Failed to get certificates from DB:', error);
    // Fallback to file-based reading for backwards compatibility
    const certFolder = path.join(__dirname, '../certificates');
    if (!fs.existsSync(certFolder)) {
      return [];
    }
    const files = fs.readdirSync(certFolder).filter(f => f.endsWith('.json'));
    const certificates = files.map(file => {
      try {
        const content = fs.readFileSync(path.join(certFolder, file), 'utf-8');
        return JSON.parse(content);
      } catch (err) {
        return null;
      }
    }).filter(Boolean);
    return certificates.sort((a, b) => new Date(b.timestamp_utc) - new Date(a.timestamp_utc));
  }
});

// Download certificate PDF (existing functionality)
ipcMain.handle('download-certificate-pdf', async (event, certificateId) => {
  const certFolder = path.join(__dirname, '../certificates');
  const pdfPath = path.join(certFolder, `certificate_${certificateId}.pdf`);

  if (fs.existsSync(pdfPath)) {
    try {
      const pdfBuffer = fs.readFileSync(pdfPath);
      return { success: true, data: pdfBuffer };
    } catch (error) {
      console.error(`Failed to read PDF ${pdfPath}:`, error);
      return { success: false, error: error.message };
    }
  } else {
    return { success: false, error: 'PDF file not found.' };
  }
});

// Get single certificate by ID from database
ipcMain.handle('get-certificate-by-id', async (event, certificateId) => {
  try {
    const cert = getCertificateById(certificateId);
    if (!cert) {
      return { success: false, error: 'Certificate not found' };
    }

    return {
      success: true,
      certificate: {
        certificate_id: cert.id,
        timestamp_utc: cert.created_at,
        device_info: {
          model: cert.device_model || 'Unknown',
          type: cert.device_type || 'Unknown',
          capacity: cert.device_size || 'Unknown',
          serial_number: cert.device_serial || 'Unknown'
        },
        erase_method: cert.erase_method || 'Unknown',
        nist_profile: cert.wipe_type,
        post_wipe_status: cert.status,
        json_path: cert.json_path,
        pdf_path: cert.pdf_path,
        simulated: cert.simulated === 1
      }
    };
  } catch (error) {
    console.error(`[Main] Failed to get certificate ${certificateId}:`, error);
    return { success: false, error: error.message };
  }
});

// ============================================
// Admin Privilege Status APIs
// ============================================

// Get current admin/elevation status
ipcMain.handle('get-admin-status', async () => {
  return getElevationStatus(isAppElevated);
});

// Restart the app with Administrator privileges
ipcMain.handle('restart-elevated', async () => {
  return restartWithElevation();
});

// Create the main application window
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../.next/standalone/index.html')}`;

  win.loadURL(startUrl);

  // Optional: Open DevTools in development
  if (isDev) {
    win.webContents.openDevTools();
  }
}

// App event handlers
app.whenReady().then(() => {
  // Check elevation status at startup
  isAppElevated = checkElevation();
  console.log(`[Main] App elevation status: ${isAppElevated ? '✅ ELEVATED (Administrator)' : '⚠️ NOT ELEVATED (Standard user)'}`);

  if (!isAppElevated) {
    console.log('[Main] Some disk operations will require Administrator privileges.');
  }

  // Initialize SQLite database
  try {
    initializeDatabase();
    console.log('[Main] Database initialized successfully');
  } catch (error) {
    console.error('[Main] Failed to initialize database:', error);
  }

  createWindow();

  // Test the native addon on startup
  console.log('Testing native addon on startup...');
  testNativeAddon();
});

app.on('window-all-closed', () => {
  // Cleanup any running operations before quitting
  console.log('Cleaning up wipe operations before quit...');
  activeWipes.clear();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  // Ensure all wipe operations are properly cleaned up
  console.log('App quitting, active wipes:', activeWipes.size);
  activeWipes.clear();

  // Close database connection
  closeDatabase();
});