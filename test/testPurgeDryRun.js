/**
 * Safe Dry-Run Test Script for Purge Methods
 * 
 * This script tests the purge methods in dry-run mode (dryRun=true by default).
 * NO destructive operations will be performed.
 * 
 * Usage:
 *   node electron/testPurgeDryRun.js
 * 
 * Requirements:
 *   - Native addon must be built: cd native && npx node-gyp rebuild
 *   - Run as Administrator for device access
 */

const path = require('path');

// Load the native addon
let addon;
try {
    const addonPath = path.join(__dirname, '..', 'native', 'build', 'Release', 'wipeAddon.node');
    addon = require(addonPath);
    console.log('✓ Native addon loaded successfully\n');
} catch (error) {
    console.error('✗ Failed to load native addon:', error.message);
    console.error('\nMake sure to build the addon first:');
    console.error('  cd native && npx node-gyp rebuild\n');
    process.exit(1);
}

// Test drive path - change to your test drive
const TEST_DRIVE = '\\\\.\\PhysicalDrive1';  // CHANGE THIS if needed

console.log('='.repeat(60));
console.log('SAFE DRY-RUN PURGE TEST');
console.log('='.repeat(60));
console.log(`Test Drive: ${TEST_DRIVE}`);
console.log('');
console.log('Available addon methods:', Object.keys(addon));
console.log('');
console.log('NOTE: All tests run with dryRun=true (default) - NO DATA WILL BE ERASED');
console.log('='.repeat(60));
console.log('');

// Test 1: ATA Secure Erase (dry run)
console.log('--- TEST 1: ATA Secure Erase (DRY RUN) ---');
try {
    // Parameters: devicePath, enhanced=false, dryRun=true (default)
    const ataResult = addon.ataSecureErase(TEST_DRIVE, false, true);
    console.log('Result:', JSON.stringify(ataResult, null, 2));
    console.log('');
} catch (error) {
    console.error('Error:', error.message);
    console.log('');
}

// Test 2: NVMe Sanitize (dry run)
console.log('--- TEST 2: NVMe Sanitize - Crypto (DRY RUN) ---');
try {
    // Parameters: devicePath, action="crypto", dryRun=true (default)
    const nvmeResult = addon.nvmeSanitize(TEST_DRIVE, 'crypto', true);
    console.log('Result:', JSON.stringify(nvmeResult, null, 2));
    console.log('');
} catch (error) {
    console.error('Error:', error.message);
    console.log('');
}

// Test 3: Crypto Erase (dry run)
console.log('--- TEST 3: Crypto Erase (DRY RUN) ---');
try {
    // Parameters: devicePath, dryRun=true (default)
    const cryptoResult = addon.cryptoErase(TEST_DRIVE, true);
    console.log('Result:', JSON.stringify(cryptoResult, null, 2));
    console.log('');
} catch (error) {
    console.error('Error:', error.message);
    console.log('');
}

console.log('='.repeat(60));
console.log('DRY-RUN TESTS COMPLETE');
console.log('');
console.log('Expected Results:');
console.log('  - USB devices: supported=false, device_type="USB"');
console.log('  - SATA devices: supported=true (if ATA security supported)');
console.log('  - NVMe devices: supported=true for NVMe sanitize');
console.log('');
console.log('NO DATA WAS ERASED - This was a safe simulation.');
console.log('='.repeat(60));
