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
console.log('  1. ATA Secure Erase (purge) - for SATA HDD/SSD');
console.log('  2. NVMe Sanitize (purge)    - for NVMe SSD');
console.log('  3. Crypto Erase (purge)     - for Self-Encrypting Drives');
console.log('  4. Destroy Drive (destroy)  - for Failed/EOL Drives');
console.log('  5. Software Wipe (clear)    - for USB / SD Cards / Generic');
console.log('='.repeat(60));

// Check available addon functions
console.log('\nAvailable addon functions:');
console.log(Object.keys(addon));

// Test 1: ATA Secure Erase (if supported)
function testATASecureErase() {
    console.log('\n--- Testing ATA Secure Erase ---');
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
    console.log('\n--- Testing NVMe Sanitize (Crypto Erase) ---');
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
    console.log('\n--- Testing Crypto Erase (Auto-Detect) ---');
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
    console.log('\n--- Testing DESTROY Drive ---');
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

// Test 5: Software Wipe (Compatible with all drives)
function testSoftwareWipe() {
    console.log('\n--- Testing Software Wipe (NIST Clear) ---');
    console.log('Recommended for USB Drives, SD Cards, and generic storage.');
    console.log('Performs a zero-fill overwrite.');
    console.log('⚠️  WARNING: This will ERASE ALL DATA on ' + TEST_DRIVE);
    console.log('Press Ctrl+C now to cancel!');

    setTimeout(() => {
        try {
            const result = addon.wipeFile(TEST_DRIVE, 'zero');
            console.log('Result:', result);
            if (result.includes('failed')) {
                console.log('\n⚠️  IMPORTANT: If you see "error: 5", you need to run this script as ADMINISTRATOR');
                console.log('Right-click PowerShell → "Run as Administrator" → then run the script again');
            }
        } catch (error) {
            console.error('Error:', error.message);
        }
    }, 5000);
}

// Uncomment the test you want to run:

// testATASecureErase();      // SATA HDD/SSD
// testNVMeSanitize();        // NVMe SSD
// testCryptoErase();         // SED / Auto-detect
// testDestroyDrive();        // Failed drives (Slow!)

testSoftwareWipe();        // <--- RUNNING THIS FOR USB DRIVE FIX

console.log('\nTo run a different test, edit this file and uncomment the desired function.');