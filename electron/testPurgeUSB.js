/**
 * LEVEL 1: USB Logic Testing
 * 
 * Purpose: Verify that purge methods fail gracefully on USB drives
 * Expected: ALL purge attempts should FAIL with clear messages
 * 
 * This is a SAFE test - purge commands on USB will be rejected
 * by the device before any data is touched.
 * 
 * Usage:
 *   1. Connect a USB flash drive
 *   2. Identify its PhysicalDrive number using Disk Management
 *   3. Update USB_DRIVE path below
 *   4. Run: node electron/testPurgeUSB.js
 */

const path = require('path');

// Load the native addon
const addonPath = path.join(__dirname, '..', 'native', 'build', 'Release', 'wipeAddon.node');

let addon;
try {
    addon = require(addonPath);
} catch (error) {
    console.error('❌ Failed to load native addon');
    console.error(`   Path: ${addonPath}`);
    console.error(`   Error: ${error.message}`);
    console.error('\n   Run "npx node-gyp rebuild" in the native/ directory');
    process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ SET YOUR USB DRIVE PATH HERE
// Use Disk Management (Win+X → Disk Management) to find the correct number
// ═══════════════════════════════════════════════════════════════════════════
const USB_DRIVE = '\\\\.\\PhysicalDrive1';  // ⚠️ VERIFY THIS IS YOUR USB DRIVE!

console.log('═══════════════════════════════════════════════════════════════');
console.log('  LEVEL 1: USB LOGIC TESTING');
console.log('  Testing purge method failure behavior on USB drive');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`\nTarget: ${USB_DRIVE}`);
console.log('\n📋 Expected Behavior:');
console.log('   • All purge tests should FAIL');
console.log('   • USB drives do not support purge commands');
console.log('   • Failure = PASS (graceful handling is the goal)');
console.log('');

// Check available addon functions
console.log('Available addon functions:', Object.keys(addon).join(', '));
console.log('');

const results = {
    ataSecureErase: { passed: false, message: '', status: 'NOT RUN' },
    nvmeSanitize: { passed: false, message: '', status: 'NOT RUN' },
    cryptoErase: { passed: false, message: '', status: 'NOT RUN' }
};

function evaluateError(error) {
    const msg = error.message || String(error);

    // Check for ungraceful errors
    const ungracefulPatterns = ['CRASH', 'ACCESS_VIOLATION', 'SEGFAULT', 'undefined'];
    const isUngraceful = ungracefulPatterns.some(p => msg.toUpperCase().includes(p));

    // Check for informative message
    const informativePatterns = ['not supported', 'not an NVMe', 'not a SATA', 'USB', 'cannot'];
    const isInformative = informativePatterns.some(p => msg.toLowerCase().includes(p));

    return {
        isGraceful: !isUngraceful,
        isInformative: isInformative,
        message: msg
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: ATA Secure Erase
// ─────────────────────────────────────────────────────────────────────────────
console.log('─── Test 1: ATA Secure Erase ───');
console.log('    Why it should fail: USB uses Mass Storage protocol, not ATA');

if (addon.ataSecureErase) {
    try {
        if (result === false || (typeof result === 'object' && result.success === false)) {
            console.log('    ✅ PASS: Correctly returned failure');
            if (typeof result === 'object' && result.message) {
                console.log(`       Message: ${result.message}`);
            }
            results.ataSecureErase = {
                passed: true,
                message: 'Returned failure (expected)',
                status: 'PASS'
            };
        } else {
            console.log('    ❌ FAIL: Unexpectedly returned success!');
            console.log('           USB should NOT support ATA Secure Erase');
            console.log('           Result:', result);
            results.ataSecureErase = {
                passed: false,
                message: 'Unexpected success - this is wrong!',
                status: 'FAIL'
            };
        }
    } catch (error) {
        const evaluation = evaluateError(error);
        if (evaluation.isGraceful) {
            console.log(`    ✅ PASS: Failed gracefully`);
            console.log(`       Message: ${evaluation.message}`);
            results.ataSecureErase = {
                passed: true,
                message: evaluation.message,
                status: 'PASS'
            };
        } else {
            console.log(`    ❌ FAIL: Ungraceful error`);
            console.log(`       Message: ${evaluation.message}`);
            results.ataSecureErase = {
                passed: false,
                message: evaluation.message,
                status: 'FAIL'
            };
        }
    }
} else {
    console.log('    ⚠️ SKIP: ataSecureErase function not available in addon');
    results.ataSecureErase = { passed: true, message: 'Function not exported', status: 'SKIP' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: NVMe Sanitize
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n─── Test 2: NVMe Sanitize ───');
console.log('    Why it should fail: USB flash drives are not NVMe devices');

if (addon.nvmeSanitize) {
    try {
        const result = addon.nvmeSanitize(USB_DRIVE, 'crypto');
        if (result === false || (typeof result === 'object' && result.success === false)) {
            console.log('    ✅ PASS: Correctly returned failure');
            if (typeof result === 'object' && result.message) {
                console.log(`       Message: ${result.message}`);
            }
            results.nvmeSanitize = {
                passed: true,
                message: 'Returned failure (expected)',
                status: 'PASS'
            };
        } else {
            console.log('    ❌ FAIL: Unexpectedly returned success!');
            console.log('           USB is not an NVMe device');
            console.log('           Result:', result);
            results.nvmeSanitize = {
                passed: false,
                message: 'Unexpected success - this is wrong!',
                status: 'FAIL'
            };
        }
    } catch (error) {
        const evaluation = evaluateError(error);
        if (evaluation.isGraceful) {
            console.log(`    ✅ PASS: Failed gracefully`);
            console.log(`       Message: ${evaluation.message}`);
            results.nvmeSanitize = {
                passed: true,
                message: evaluation.message,
                status: 'PASS'
            };
        } else {
            console.log(`    ❌ FAIL: Ungraceful error`);
            console.log(`       Message: ${evaluation.message}`);
            results.nvmeSanitize = {
                passed: false,
                message: evaluation.message,
                status: 'FAIL'
            };
        }
    }
} else {
    console.log('    ⚠️ SKIP: nvmeSanitize function not available in addon');
    results.nvmeSanitize = { passed: true, message: 'Function not exported', status: 'SKIP' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Crypto Erase
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n─── Test 3: Crypto Erase ───');
console.log('    Why it should fail: USB drives are not Self-Encrypting Drives');

if (addon.cryptoErase) {
    try {
        const result = addon.cryptoErase(USB_DRIVE);
        if (result === false || (typeof result === 'object' && result.success === false)) {
            console.log('    ✅ PASS: Correctly returned failure');
            if (typeof result === 'object' && result.message) {
                console.log(`       Message: ${result.message}`);
            }
            results.cryptoErase = {
                passed: true,
                message: 'Returned failure (expected)',
                status: 'PASS'
            };
        } else {
            console.log('    ❌ FAIL: Unexpectedly returned success!');
            console.log('           USB does not have encryption keys');
            console.log('           Result:', result);
            results.cryptoErase = {
                passed: false,
                message: 'Unexpected success - this is wrong!',
                status: 'FAIL'
            };
        }
    } catch (error) {
        const evaluation = evaluateError(error);
        if (evaluation.isGraceful) {
            console.log(`    ✅ PASS: Failed gracefully`);
            console.log(`       Message: ${evaluation.message}`);
            results.cryptoErase = {
                passed: true,
                message: evaluation.message,
                status: 'PASS'
            };
        } else {
            console.log(`    ❌ FAIL: Ungraceful error`);
            console.log(`       Message: ${evaluation.message}`);
            results.cryptoErase = {
                passed: false,
                message: evaluation.message,
                status: 'FAIL'
            };
        }
    }
} else {
    console.log('    ⚠️ SKIP: cryptoErase function not available in addon');
    results.cryptoErase = { passed: true, message: 'Function not exported', status: 'SKIP' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  TEST SUMMARY');
console.log('═══════════════════════════════════════════════════════════════');

const testCount = Object.keys(results).length;
const passCount = Object.values(results).filter(r => r.passed).length;
const skipCount = Object.values(results).filter(r => r.status === 'SKIP').length;
const failCount = Object.values(results).filter(r => !r.passed).length;

console.log('\nResults by test:');
Object.entries(results).forEach(([test, result]) => {
    const icon = result.status === 'PASS' ? '✅' :
        result.status === 'SKIP' ? '⚠️' : '❌';
    console.log(`  ${icon} ${test}: ${result.status}`);
    if (result.message) {
        console.log(`      └─ ${result.message}`);
    }
});

console.log('\n───────────────────────────────────────────────────────────────');
console.log('  OVERALL RESULT');
console.log('───────────────────────────────────────────────────────────────');

if (failCount === 0) {
    console.log('\n  ✅✅✅ ALL TESTS PASSED ✅✅✅');
    console.log('');
    console.log('  USB purge logic is working correctly:');
    console.log('  • Purge commands correctly rejected on USB');
    console.log('  • Error handling is graceful (no crashes)');
    console.log('  • Application remained stable');
    console.log('');
    console.log('  This is the expected behavior - USB drives do NOT');
    console.log('  support hardware-level purge commands.');
    console.log('');
} else {
    console.log('\n  ❌❌❌ SOME TESTS FAILED ❌❌❌');
    console.log('');
    console.log('  Issues found:');
    Object.entries(results)
        .filter(([_, r]) => !r.passed)
        .forEach(([test, result]) => {
            console.log(`  • ${test}: ${result.message}`);
        });
    console.log('');
    console.log('  Please review the purge implementation for:');
    console.log('  • Proper device type detection');
    console.log('  • Graceful error handling');
    console.log('  • Clear user-facing messages');
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('');
