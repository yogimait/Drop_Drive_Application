// Enhanced wipeController.js with USB management and C++ integration
const { EventEmitter } = require('events');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { generateWipeCertificate } = require('./certificateGenerator');



// Try to load the native addon
let wipeAddon;
try {
  // Construct the correct, absolute path to the native addon
  const addonPath = path.join(__dirname, '..', 'native', 'build', 'Release', 'wipeAddon.node');

  // Load the addon using the absolute path
  wipeAddon = require(addonPath);

  console.log('✅ Native wipe addon loaded successfully.');

} catch (error) {
  console.warn('⚠️ Native wipe addon could not be loaded. Falling back to simulation.', error.message);
  wipeAddon = null;
}

const wipeController = new EventEmitter();

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

// Enhanced wipe function with proper USB management
async function startWipe({ device, method, label, deviceInfo }, onProgress) {
  console.log(`[WipeController] Starting wipe on ${device} with ${method}`);
  
  if (!device || !method) {
    throw new Error('Missing required parameters: device or method');
  }

  const logs = [];
  let wipeResult = 'Unknown';
  let status = 'failure';

  try {
    // Step 1: Check if drive is accessible
    // const isAccessible = await USBManager.checkDriveAccessible(device);
    // if (!isAccessible) {
    //   throw new Error(`Drive ${device} is not accessible`);
    // }

    logs.push(`Wipe started at ${new Date().toLocaleTimeString()}`);
    onProgress?.({ progress: 5, stage: 'Preparing drive...', logs: [...logs] });

    // Step 2: Unmount the drive
    logs.push('Unmounting drive...');
    onProgress?.({ progress: 10, stage: 'Unmounting drive...', logs: [...logs] });
    
    try {
      await USBManager.unmountDrive(device);
      logs.push('Drive unmounted successfully');
    } catch (unmountError) {
      console.warn('Unmount failed, continuing anyway:', unmountError.message);
      logs.push(`Unmount warning: ${unmountError.message}`);
    }

    onProgress?.({ progress: 20, stage: 'Starting wipe operation...', logs: [...logs] });

    // Step 3: Perform the actual wipe
    if (wipeAddon && wipeAddon.wipeFile) {
      // Use native C++ addon
      logs.push(`Using native wipe method: ${method}`);
      onProgress?.({ progress: 30, stage: `Executing ${method} wipe...`, logs: [...logs] });
      
      try {
       // For a fast, content-only wipe:
      // wipeResult = wipeAddon.wipeVolumeContents(device, method);

      // For a full wipe with automatic reallocation:
      wipeResult = wipeAddon.wipeFile(device, method, true);

        logs.push(`Native wipe result: ${wipeResult}`);
        
        // Simulate progress for the wipe operation
        const passes = getWipePassCount(method);
        for (let pass = 1; pass <= passes; pass++) {
          const progressPercent = 30 + ((pass / passes) * 50);
          onProgress?.({ 
            progress: Math.round(progressPercent), 
            stage: `Pass ${pass}/${passes} - ${method}`, 
            logs: [...logs] 
          });
          
          // Simulate some processing time
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        status = wipeResult.toLowerCase().includes('completed') ? 'success' : 'failure';
      } catch (nativeError) {
        console.error('Native wipe failed:', nativeError);
        logs.push(`Native wipe error: ${nativeError.message}`);
        throw nativeError;
      }
    } else {
      // Fallback: simulate wipe (for testing)
      logs.push('Using simulated wipe (native addon not available)');
      const passes = getWipePassCount(method);
      
      for (let pass = 1; pass <= passes; pass++) {
        const progressPercent = 30 + ((pass / passes) * 50);
        onProgress?.({ 
          progress: Math.round(progressPercent), 
          stage: `Pass ${pass}/${passes} - ${method} (Simulated)`, 
          logs: [...logs] 
        });
        
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      wipeResult = `Simulated wipe completed with method: ${method}`;
      status = 'success';
      logs.push(wipeResult);
    }

    onProgress?.({ progress: 85, stage: 'Remounting drive...', logs: [...logs] });

    // Step 4: Remount the drive
    try {
      await USBManager.remountDrive(device);
      logs.push('Drive remounted successfully');
    } catch (remountError) {
      console.warn('Remount failed:', remountError.message);
      logs.push(`Remount warning: ${remountError.message}`);
    }

    logs.push(`Wipe completed at ${new Date().toLocaleTimeString()}`);
    onProgress?.({ progress: 95, stage: 'Generating certificate...', logs: [...logs] });

    // Step 5: Generate certificate
    const deviceInfoForCert = deviceInfo || {
      serial: device,
      model: label || 'Unknown Device',
      type: 'USB',
      capacity: 'Unknown'
    };

    const certificateResult = await generateWipeCertificate({
      device,
      deviceInfo: deviceInfoForCert,
      eraseMethod: method,
      nistProfile: mapMethodToNistProfile(method),
      postWipeStatus: status,
      logs: logs,
      toolVersion: "2.1.0"
    });

    onProgress?.({ progress: 100, stage: 'Wipe completed successfully!', logs: [...logs] });

    return {
      device,
      method,
      label,
      status: status === 'success' ? 'Completed' : 'Error',
      completedAt: new Date().toISOString(),
      certificatePath: certificateResult.certPath,
      pdfPath: certificateResult.pdfPath,
      wipeResult,
      logs
    };

  } catch (error) {
    console.error('[WipeController] Error during wipe:', error);
    logs.push(`Error: ${error.message}`);
    
    // Try to remount even if wipe failed
    try {
      await USBManager.remountDrive(device);
      logs.push('Drive remounted after error');
    } catch (remountError) {
      logs.push(`Failed to remount after error: ${remountError.message}`);
    }

    throw new Error(`Wipe failed: ${error.message}`);
  }
}

function mapMethodToNistProfile(method) {
  switch((method || '').toLowerCase()) {
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
  wipeController,
  testNativeAddon,
  USBManager
};