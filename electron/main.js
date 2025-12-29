const { app, BrowserWindow, ipcMain } = require('electron');
const { listDrives } = require('./deviceManager');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';
const os = require('os');
const si = require('systeminformation');
const { startWipe, testNativeAddon } = require('./wipeController'); 
const { generateWipeCertificate } = require('./certificateGenerator');
const fs = require('fs');

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
ipcMain.handle('start-wipe', async (event, wipeParams) => {
  const { device, method, label, deviceInfo } = wipeParams;
  const wipeId = `wipe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`[Main] Starting wipe operation ${wipeId}:`, wipeParams);

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
      device,
      method,
      label,
      startedAt: new Date().toISOString(),
      status: 'running'
    });

    // Send initial status
    event.sender.send('wipe-started', { wipeId, device, method, label });

    // Start the wipe operation (this is async)
    const result = await startWipe({ device, method, label, deviceInfo }, onProgress);
    
    // Update stored operation
    activeWipes.set(wipeId, {
      ...activeWipes.get(wipeId),
      status: 'completed',
      completedAt: result.completedAt,
      certificatePath: result.certificatePath,
      pdfPath: result.pdfPath
    });

    // Send completion status
    event.sender.send('wipe-completed', {
      wipeId,
      result
    });

    console.log(`[Main] Wipe operation ${wipeId} completed successfully`);
    return { success: true, wipeId, result };

  } catch (error) {
    console.error(`[Main] Wipe operation ${wipeId} failed:`, error);
    
    // Update stored operation with error
    activeWipes.set(wipeId, {
      ...activeWipes.get(wipeId),
      status: 'error',
      error: error.message,
      completedAt: new Date().toISOString()
    });

    // Send error status
    event.sender.send('wipe-error', {
      wipeId,
      error: error.message
    });

    return { success: false, wipeId, error: error.message };
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
    // Note: Actual stopping of C++ operation would need to be implemented
    // For now, we'll just mark it as cancelled
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

// Get all certificates (existing functionality)
ipcMain.handle('get-certificates', async () => {
  const certFolder = path.join(__dirname, '../certificates');

  if (!fs.existsSync(certFolder)) {
    console.log("Certificate directory not found, creating it.");
    fs.mkdirSync(certFolder, { recursive: true });
    return [];
  }

  const files = fs.readdirSync(certFolder).filter(f => f.endsWith('.json'));
  
  const certificates = files.map(file => {
    try {
      const content = fs.readFileSync(path.join(certFolder, file), 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Failed to parse certificate ${file}:`, error);
      return null;
    }
  }).filter(Boolean);

  return certificates.sort((a, b) => new Date(b.timestamp_utc) - new Date(a.timestamp_utc));
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
});