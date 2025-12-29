# DropDrive NIST 800-88 Purge and Destroy Testing Guide

## ⚠️ CRITICAL SAFETY WARNING ⚠️

**NEVER TEST THIS ON:**
- System drives (C:\\ or any primary OS drive)
- Drives with important data
- Production drives
- Drives you cannot afford to lose

**ONLY TEST ON:**
- Cheap, expendable USB flash drives (4GB-32GB recommended)
- Drives you are prepared to completely lose forever
- Drives clearly labeled as "TEST ONLY"

---

## Prerequisites

### Hardware Requirements
1. **Test USB Drive**: A cheap USB flash drive that you can completely destroy
   - Recommended: 8GB-16GB USB 2.0 or USB 3.0
   - Cost: $5-15 (expendable)
   - Label it clearly: "TEST - WIPE ONLY"

2. **Computer**: Windows 10/11 with Administrator privileges

3. **Optional**: Second computer for verification (not strictly necessary)

### Software Requirements
1. Visual Studio Build Tools (already installed if you've built the project before)
2. node-gyp
3. Administrator Command Prompt

---

##Step 1: Build the Native Addon

Open an **Administrator Command Prompt** and navigate to the native directory:

```bash
cd c:\Users\Hp\Desktop\Disk_cleaner\DropDrive_forked\native
npx node-gyp rebuild
```

**Expected Output:**
```
Building the projects in this solution one at a time...
wipeAddon.vcxproj -> c:\Users\Hp\Desktop\Disk_cleaner\DropDrive_forked\native\build\Release\wipeAddon.node
```

**If build fails:**
- Check that all source files exist
- Verify Visual Studio Build Tools are installed
- Check for compilation errors (usually missing headers)

---

## Step 2: Identify Your Test Drive

**CRITICAL: Make absolutely sure you're identifying the correct drive!**

### Method 1: Using Disk Management
1. Press `Win + X` → Disk Management
2. Insert your test USB drive
3. Identify it by size and label
4. Note the **Disk number** (e.g., Disk 1, Disk 2, etc.)
5. The PhysicalDrive path will be: `\\\\.\\PhysicalDrive<NUMBER>`
   - Example: Disk 1 = `\\\\.\\PhysicalDrive1`

### Method 2: Using diskpart
```bash
# Open Command Prompt as Administrator
diskpart
list disk

# Output example:
#   Disk 0    476 GB   (Your main drive - DON'T TOUCH)
#   Disk 1      8 GB   (Your USB test drive - THIS ONE)

exit
```

**Double-check:** The test drive should be:
- Much smaller than your main drive
- Removable
- Not in use by any applications

**Write down your test drive path:**
```
My test drive: \\\\.\\PhysicalDrive____  (fill in the number)
```

---

## Step 3: Create a Test Script

Create a file: `c:\Users\Hp\Desktop\Disk_cleaner\DropDrive_forked\electron\testPurgeDestroy.js`

```javascript
const path = require('path');

// Load the native addon
const addonPath = path.join(__dirname, '..', 'native', 'build', 'Release', 'wipeAddon.node');
const addon = require(addonPath);

// ⚠️ CHANGE THIS TO YOUR TEST DRIVE!
const TEST_DRIVE = '\\\\.\\PhysicalDrive1';  // VERIFY THIS IS YOUR USB DRIVE!

console.log('='.repeat(60));
console.log('NIST 800-88 Purge/Destroy Test Script');
console.log('='.repeat(60));
console.log(`Test Drive: ${TEST_DRIVE}`);
console.log('');
console.log('Available methods:');
console.log('  1. ATA Secure Erase (purge)');
console.log('  2. NVMe Sanitize - Crypto Erase (purge)');
console.log('  3. Crypto Erase (purge)');
console.log('  4. Destroy Drive (destroy)');
console.log('='.repeat(60));

// Check available addon functions
console.log('\\nAvailable addon functions:');
console.log(Object.keys(addon));

// Test 1: ATA Secure Erase (if supported)
function testATASecureErase() {
    console.log('\\n--- Testing ATA Secure Erase ---');
    console.log('⚠️  WARNING: This will ERASE ALL DATA on ' + TEST_DRIVE);
    console.log('Press Ctrl+C now to cancel!');
    
    setTimeout(() => {
        try {
            const result = addon.ataSecureErase(TEST_DRIVE, false);
            console.log('Result:', result ? 'SUCCESS' : 'FAILED');
        } catch (error) {
            console.error('Error:', error.message);
        }
    }, 5000);  // 5 second countdown
}

// Test 2: NVMe Sanitize Crypto Erase (if supported)
function testNVMeSanitize() {
    console.log('\\n--- Testing NVMe Sanitize (Crypto Erase) ---');
    console.log('⚠️  WARNING: This will ERASE ALL DATA on ' + TEST_DRIVE);
    console.log('Press Ctrl+C now to cancel!');
    
    setTimeout(() => {
        try {
            const result = addon.nvmeSanitize(TEST_DRIVE, 'crypto');
            console.log('Result:', result ? 'SUCCESS' : 'FAILED');
        } catch (error) {
            console.error('Error:', error.message);
        }
    }, 5000);
}

// Test 3: Crypto Erase (auto-detect method)
function testCryptoErase() {
    console.log('\\n--- Testing Crypto Erase (Auto-Detect) ---');
    console.log('⚠️  WARNING: This will ERASE ALL DATA on ' + TEST_DRIVE);
    console.log('Press Ctrl+C now to cancel!');
    
    setTimeout(() => {
        try {
            const result = addon.cryptoErase(TEST_DRIVE);
            console.log('Result:', result ? 'SUCCESS' : 'FAILED');
        } catch (error) {
            console.error('Error:', error.message);
        }
    }, 5000);
}

// Test 4: Destroy Drive (MOST DESTRUCTIVE)
function testDestroyDrive() {
    console.log('\\n--- Testing DESTROY Drive ---');
    console.log('⚠️⚠️⚠️  CRITICAL WARNING  ⚠️⚠️⚠️');
    console.log('This will:');
    console.log('  - Perform 35-pass Gutmann wipe');
    console.log('  - Destroy partition tables');
    console.log('  - Make the drive UNBOOTABLE');
    console.log('  - Take SEVERAL HOURS for larger drives');
    console.log('');
    console.log('Target: ' + TEST_DRIVE);
    console.log('Press Ctrl+C NOW to cancel!');
    
    setTimeout(() => {
        try {
            // Note: confirm=true is required
            const result = addon.destroyDrive(TEST_DRIVE, true);
            console.log('Result:', result ? 'SUCCESS  - Drive completely destroyed' : 'FAILED');
        } catch (error) {
            console.error('Error:', error.message);
        }
    }, 10000);  // 10 second countdown for destroy
}

// Uncomment only ONE test at a time:

// testATASecureErase();      // Test ATA Secure Erase
// testNVMeSanitize();        // Test NVMe Sanitize
// testCryptoErase();         // Test Crypto Erase
// testDestroyDrive();        // Test DESTROY (most dangerous)

console.log('\\nTo run a test, uncomment one of the test functions at the bottom of this file.');
console.log('Then run: node electron/testPurgeDestroy.js');
```

---

## Step 4: Testing Each Method

### Test A: ATA Secure Erase

1. **Edit testPurgeDestroy.js:**
   - Set `TEST_DRIVE` to your USB drive path
   - Uncomment `testATASecureErase();`

2. **Run the test:**
   ```bash
   cd c:\Users\Hp\Desktop\Disk_cleaner\DropDrive_forked
   node electron/testPurgeDestroy.js
   ```

3. **Expected behavior:**
   - 5-second countdown
   - Security status check
   - If supported: Executes secure erase (10-30 minutes for USB)
   - If not supported: Error message

4. **Verification:**
   - Open Disk Management
   - Drive should appear as "Unallocated"
   - Right-click → Initialize Disk → Format to use again

### Test B: NVMe Sanitize

1. **Edit testPurgeDestroy.js:**
   - Uncomment `testNVMeSanitize();`
   - Comment out other tests

2. **Run:**
   ```bash
   node electron/testPurgeDestroy.js
   ```

3. **Expected:**
   - Most USB drives are NOT NVMe
   - Should see "ERROR: Drive is not an NVMe device"
   - This is NORMAL - test passes if error is graceful

### Test C: Crypto Erase

1. **Edit testPurgeDestroy.js:**
   - Uncomment `testCryptoErase();`

2. **Run:**
   ```bash
   node electron/testPurgeDestroy.js
   ```

3. **Expected:**
   - Detects drive type
   - Falls back to ATA Secure Erase for most USB drives
   - Should complete successfully

### Test D: DESTROY Drive (Use Smallest USB Drive!)

**⚠️ THIS WILL TAKE SEVERAL HOURS! Use the smallest USB drive you have (4-8GB recommended).**

1. **Edit testPurgeDestroy.js:**
   - Uncomment `testDestroyDrive();`

2. **Run:**
   ```bash
   node electron/testPurgeDestroy.js
   ```

3. **Expected:**
   - 10-second countdown
   - Gutmann 35-pass wipe (VERY SLOW - hours for 8GB)
   - Partition table destruction
   - Final random pass

4. **Time estimates:**
   - 4GB USB: 2-4 hours
   - 8GB USB: 4-8 hours
   - 16GB USB: 8-16 hours

5. **Verification after destroy:**
   - Drive will NOT appear in File Explorer
   - In Disk Management: Shows as "Unknown" or "Not Initialized"
   - **Recovery:**
     ```bash
     diskpart
     list disk
     select disk <number>
     clean
     create partition primary
     format fs=ntfs quick
     assign
     exit
     ```

---

## Step 5: Integration Testing (Optional)

Test from the Electron app UI:

1. **Run the app:**
   ```bash
   npm run dev:all
   ```

2. **Navigate to Wipe Process**

3. **Select your TEST USB drive**

4. **Choose a Purge or Destroy method**

5. **Confirm warnings**

6. **Monitor progress**

7. **Check certificate generation**

---

## Success Criteria

✅ **Build succeeds** without errors  
✅ **Addon loads** correctly  
✅ **Device detection** works (graceful errors for unsupported operations)  
✅ **ATA Secure Erase** completes on supported drives  
✅ **NVMe methods** fail gracefully on non-NVMe drives  
✅ **Destroy** completes and makes drive unbootable  
✅ **No application crashes**  
✅ **Certificates generated** with correct NIST profiles  

---

## Troubleshooting

### Build Errors

**nvme.h not found:**
- Windows SDK might be outdated
- Update to latest Windows SDK via Visual Studio Installer

**Compilation errors:**
- Check C++17 support in Visual Studio Build Tools
- Verify all source files are in correct locations

### Runtime Errors

**"Drive is frozen":**
- Reboot computer
- Try a different USB port
- Some drives are permanently frozen - use a different drive

**"Not an NVMe device":**
- This is expected for most USB drives
- NVMe USB adapters are rare and expensive

**Operation hangs:**
- ATA Secure Erase can take hours for large drives
- Check Task Manager for disk activity
- If truly hung, may need to power cycle drive

### Recovery

**Drive not recognized after wipe:**
```bash
# Open Command Prompt as Administrator
diskpart
list disk
select disk <number>
clean
create partition primary
format fs=ntfs quick
assign
exit
```

**Error 5 (Access Denied):**
- Run Command Prompt as Administrator
- Close any applications accessing the drive

---

## Notes for Production Use

1. **Always show multiple warnings** before execute
2. **Require explicit user confirmation** for Destroy
3. **Show estimated time** (can be hours)
4. **Add progress callbacks** for long operations
5. **Log all operations** for audit trails
6. **Test on various** drive types and sizes
7. **Consider timeout handling** for very long operations

---

## Safety Checklist

Before running ANY test:

- [ ] I am using a TEST USB drive with NO important data
- [ ] I have verified the PhysicalDrive number multiple times
- [ ] The drive is NOT my system drive (C:\\)
- [ ] I am running as Administrator
- [ ] I understand this will ERASE ALL DATA
- [ ] I am prepared for the operation to take hours (for Destroy)
- [ ] I have read and understand the recovery procedures

---

## Emergency Stop

If you need to stop an operation:

1. **DO NOT** pull out the USB drive during operation
2. Press `Ctrl+C` in the terminal (if operation hasn't started yet)
3. For running operations:
   - ATA Secure Erase: Cannot be stopped once started
   - Other operations: Can terminate with Task Manager

**After emergency stop:**
- Drive may be in inconsistent state
- Use diskpart recovery procedure above
- May need to low-level format

---

## Contact

If you encounter issues:
1. Check the error messages carefully
2. Verify you're testing on the correct drive
3. Check Windows Event Viewer for system errors
4. Document the exact steps that led to the error

---

**Remember: These operations are IRREVERSIBLE. Always test on expendable drives!**
