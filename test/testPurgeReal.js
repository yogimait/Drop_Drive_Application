/**
 * LEVEL 3: Real Purge Testing
 * 
 * ⚠️⚠️⚠️ DANGER: This WILL destroy all data on the target drive! ⚠️⚠️⚠️
 * 
 * Purpose: Execute actual purge to validate complete functionality
 * Expected: Purge completes, data unrecoverable, certificate generated
 * 
 * REQUIREMENTS:
 * - Expendable internal SATA SSD/HDD or NVMe drive
 * - NOT a USB flash drive (purge won't work on USB)
 * - Drive must be completely empty or contain only expendable data
 * - Administrator privileges required
 * 
 * Usage:
 *   1. Connect an expendable internal drive
 *   2. Identify its PhysicalDrive number using Disk Management
 *   3. TRIPLE-CHECK this is not your system drive!
 *   4. Update EXPENDABLE_DRIVE path below
 *   5. Run: node electron/testPurgeReal.js
 *   6. Type the confirmation phrase when prompted
 */

const path = require('path');
const fs = require('fs');
const readline = require('readline');

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
// ⚠️⚠️⚠️ SET YOUR EXPENDABLE DRIVE PATH HERE ⚠️⚠️⚠️
// TRIPLE-CHECK this is NOT your system drive or any important drive!
// ═══════════════════════════════════════════════════════════════════════════
const EXPENDABLE_DRIVE = '\\\\.\\PhysicalDrive1';  // ⚠️ VERIFY CAREFULLY!

// Safety phrase - must be typed exactly
const CONFIRMATION_PHRASE = 'I UNDERSTAND THIS WILL DESTROY ALL DATA';

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

async function getUserInput(prompt) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function countdown(seconds) {
    for (let i = seconds; i > 0; i--) {
        process.stdout.write(`\r⏱️  Starting in ${i} seconds... (Ctrl+C to abort)`);
        await new Promise(r => setTimeout(r, 1000));
    }
    process.stdout.write('\r' + ' '.repeat(60) + '\r');
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Test Function
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ⚠️⚠️⚠️  LEVEL 3: REAL PURGE TEST  ⚠️⚠️⚠️');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('  This test will PERMANENTLY DESTROY all data on the target');
    console.log('  drive using hardware-level purge commands.');
    console.log('');
    console.log('  The operation CANNOT be undone.');
    console.log('  Data may be unrecoverable even with forensic tools.');
    console.log('');
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`  Target Drive: ${EXPENDABLE_DRIVE}`);
    console.log('───────────────────────────────────────────────────────────────');

    // Get drive info before proceeding
    console.log('\n[PRE-CHECK] Gathering drive information...\n');

    try {
        if (addon.getDeviceSize) {
            const size = addon.getDeviceSize(EXPENDABLE_DRIVE);
            const sizeGB = (size / (1024 * 1024 * 1024)).toFixed(2);
            console.log(`  Size: ${sizeGB} GB`);
        }

        if (addon.isNVMeDevice) {
            const isNVMe = addon.isNVMeDevice(EXPENDABLE_DRIVE);
            console.log(`  Type: ${isNVMe ? 'NVMe SSD' : 'SATA (HDD/SSD)'}`);
        }

        if (addon.isRemovable) {
            const removable = addon.isRemovable(EXPENDABLE_DRIVE);
            console.log(`  Removable: ${removable ? 'Yes (USB?)' : 'No (Internal)'}`);

            if (removable) {
                console.log('\n  ⚠️ WARNING: This appears to be a removable drive!');
                console.log('  USB flash drives do NOT support purge commands.');
                console.log('  If this is a USB drive, the test will likely fail.\n');
            }
        }
    } catch (error) {
        console.log(`  Unable to gather info: ${error.message}`);
    }

    console.log('');
    console.log('───────────────────────────────────────────────────────────────');
    console.log('  SAFETY CONFIRMATION REQUIRED');
    console.log('───────────────────────────────────────────────────────────────');
    console.log('');
    console.log('  To proceed, type the following phrase EXACTLY:');
    console.log(`  "${CONFIRMATION_PHRASE}"`);
    console.log('');

    const answer = await getUserInput('  Confirm: ');

    if (answer !== CONFIRMATION_PHRASE) {
        console.log('\n  ❌ Confirmation failed.');
        console.log('     The phrase must match exactly.');
        console.log('     Test aborted (this is the safe outcome).\n');
        process.exit(0);
    }

    console.log('\n  ✅ Confirmation accepted.');
    console.log('');

    await countdown(10);

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  EXECUTING REAL PURGE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    const startTime = Date.now();
    let success = false;
    let methodUsed = '';

    // ─────────────────────────────────────────────────────────────────────────
    // Attempt Purge Methods in Order
    // ─────────────────────────────────────────────────────────────────────────

    // Method 1: ATA Secure Erase (most common for SATA drives)
    if (addon.ataSecureErase) {
        console.log('[1/3] Attempting ATA Secure Erase...');
        console.log('      This is the standard method for SATA SSDs and HDDs.');
        console.log('');

        try {
            const result = addon.ataSecureErase(EXPENDABLE_DRIVE, true);
            if (result === true) {
                success = true;
                methodUsed = 'ATA Secure Erase';
            } else {
                console.log('      ✗ ATA Secure Erase returned false');
                console.log('        Drive may not support this method.\n');
            }
        } catch (error) {
            console.log(`      ✗ ATA Secure Erase failed: ${error.message}`);
            console.log('        Trying next method...\n');
        }
    }

    // Method 2: NVMe Sanitize (for NVMe SSDs)
    if (!success && addon.nvmeSanitize) {
        console.log('[2/3] Attempting NVMe Sanitize (Crypto Erase)...');
        console.log('      This is the standard method for NVMe SSDs.');
        console.log('');

        try {
            const result = addon.nvmeSanitize(EXPENDABLE_DRIVE, 'crypto');
            if (result === true) {
                success = true;
                methodUsed = 'NVMe Sanitize (Crypto)';
            } else {
                console.log('      ✗ NVMe Sanitize returned false');
                console.log('        Drive may not be an NVMe device.\n');
            }
        } catch (error) {
            console.log(`      ✗ NVMe Sanitize failed: ${error.message}`);
            console.log('        Trying next method...\n');
        }
    }

    // Method 3: Crypto Erase (for Self-Encrypting Drives)
    if (!success && addon.cryptoErase) {
        console.log('[3/3] Attempting Crypto Erase...');
        console.log('      This method works on Self-Encrypting Drives (SEDs).');
        console.log('');

        try {
            const result = addon.cryptoErase(EXPENDABLE_DRIVE);
            if (result === true) {
                success = true;
                methodUsed = 'Crypto Erase';
            } else {
                console.log('      ✗ Crypto Erase returned false');
                console.log('        Drive may not be a Self-Encrypting Drive.\n');
            }
        } catch (error) {
            console.log(`      ✗ Crypto Erase failed: ${error.message}`);
        }
    }

    const duration = Date.now() - startTime;

    // ─────────────────────────────────────────────────────────────────────────
    // Results
    // ─────────────────────────────────────────────────────────────────────────

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  TEST RESULTS');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    if (success) {
        console.log('  ✅✅✅ PURGE COMPLETED SUCCESSFULLY ✅✅✅');
        console.log('');
        console.log(`  Method Used: ${methodUsed}`);
        console.log(`  Duration: ${formatDuration(duration)}`);
        console.log(`  Target: ${EXPENDABLE_DRIVE}`);
        console.log('');

        // Check for certificate
        const certsDir = path.join(__dirname, '..', 'certificates');
        if (fs.existsSync(certsDir)) {
            const certs = fs.readdirSync(certsDir)
                .filter(f => f.endsWith('.json'))
                .sort()
                .reverse();

            if (certs.length > 0) {
                console.log('  Certificate Status:');
                console.log(`    ✅ Latest: ${certs[0]}`);
                console.log(`    Total certificates: ${certs.length}`);
            } else {
                console.log('  Certificate Status:');
                console.log('    ⚠️ No certificates found in certificates/ folder');
                console.log('       Certificate generation may need to be triggered separately.');
            }
        }

        console.log('');
        console.log('───────────────────────────────────────────────────────────────');
        console.log('  POST-PURGE VERIFICATION STEPS');
        console.log('───────────────────────────────────────────────────────────────');
        console.log('');
        console.log('  1. Open Disk Management (Win+X → Disk Management)');
        console.log('     - Drive should appear as "Unallocated" or "Not Initialized"');
        console.log('');
        console.log('  2. (Optional) Use a hex viewer to verify data is zeroed/random');
        console.log('     - Try HxD or similar tool');
        console.log('     - Read the first few sectors');
        console.log('');
        console.log('  3. (Optional) Try data recovery software');
        console.log('     - If recovery fails, purge was successful');
        console.log('');
        console.log('  4. To use the drive again, reinitialize it:');
        console.log('     - Right-click in Disk Management → Initialize Disk');
        console.log('     - Create new partition and format');
        console.log('');

    } else {
        console.log('  ❌❌❌ PURGE FAILED ❌❌❌');
        console.log('');
        console.log('  No purge method succeeded on this drive.');
        console.log('');
        console.log('  Possible reasons:');
        console.log('  • Drive is a USB flash drive (purge not supported)');
        console.log('  • Drive is frozen (try power cycling)');
        console.log('  • Drive has security locked (password required)');
        console.log('  • Drive does not support hardware purge commands');
        console.log('  • Insufficient privileges (run as Administrator)');
        console.log('');
        console.log('  Alternative actions:');
        console.log('  • Use NIST 800-88 Clear (software overwrite) instead');
        console.log('  • Use Destroy (35-pass Gutmann) for maximum erasure');
        console.log('  • For USB drives, only Clear/Destroy are available');
        console.log('');
        console.log(`  Duration before failure: ${formatDuration(duration)}`);
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    process.exit(success ? 0 : 1);
}

// Run the test
main().catch(error => {
    console.error('\n❌ Unexpected error:', error.message);
    console.error(error.stack);
    process.exit(1);
});
