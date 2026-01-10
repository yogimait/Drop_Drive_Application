# DropDrive Frontend Testing Guide

> **For Developers Testing Without Real Hardware Destruction**

---

## 📖 Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Test Environment Setup](#test-environment-setup)
4. [Running UI Tests](#running-ui-tests)
5. [Test Cases with Screenshots](#test-cases-with-screenshots)
6. [Interpreting Results](#interpreting-results)
7. [Troubleshooting](#troubleshooting)
8. [Appendix: Test Checklist](#appendix-test-checklist)

---

## 🚀 Quick Start

```bash
# 1. Build native addon
cd native
npx node-gyp rebuild

# 2. Start the app
cd ..
npm run electron:dev

# 3. Run command-line tests (optional)
node electron/testPurgeDryRun.js
node electron/testPurgeUSB.js  # Requires USB drive
```

---

## ✅ Prerequisites

### Hardware

| Item | Required | Notes |
|------|----------|-------|
| USB Flash Drive | Recommended | Any size, for purge failure testing |
| Internal SATA/NVMe | Optional | Only for real purge testing |
| Admin Rights | **Required** | Must run elevated for device access |

### Software

```bash
# Verify Node.js
node --version  # Should be v18+

# Verify native addon builds
cd native
npx node-gyp rebuild

# Expected output: "gyp info ok"
```

---

## 🔧 Test Environment Setup

### Step 1: Build the Project

```bash
# Install dependencies
npm install

# Build native addon
cd native
npx node-gyp rebuild
cd ..
```

### Step 2: Run as Administrator

> [!IMPORTANT]
> DropDrive requires admin privileges for device access.

**Windows:**
1. Right-click Command Prompt or PowerShell
2. Select "Run as Administrator"
3. Navigate to project folder
4. Run `npm run electron:dev`

### Step 3: Connect Test Device (Optional)

If testing USB failure scenarios:
1. Insert USB flash drive
2. Note the drive letter (e.g., E:)
3. Find PhysicalDrive number:
   - Open Disk Management (Win+X → Disk Management)
   - Find your USB (shows as "Removable")
   - Note the Disk number (e.g., Disk 2 = `\\.\PhysicalDrive2`)

---

## 🧪 Running UI Tests

### Test 1: Application Launch

**Goal:** Verify app starts correctly with native addon loaded.

**Steps:**
1. Start: `npm run electron:dev`
2. Wait for window to appear
3. Navigate to "Wipe Process" page
4. Click "Test Addon" button

**Expected:**
```
✅ Alert: "Native Addon Test: Success: true"
```

**If Failed:**
```
❌ Alert: "Native Addon Test Failed: Cannot find module..."
→ Run: cd native && npx node-gyp rebuild
```

---

### Test 2: Drive Detection

**Goal:** Verify all connected drives are detected.

**Steps:**
1. Open Wipe Process page
2. Click the drive dropdown
3. Compare visible drives with Disk Management

**Expected:**
- All mounted drives appear
- Each shows: Name, Path (e.g., E:), Size, Bus Type (USB/SATA/NVMe)
- System drive (C:) should appear but use with extreme caution

**Pass Criteria:**
| Check | Pass If |
|-------|---------|
| Drive count | Matches Disk Management |
| Drive names | Correct descriptions |
| Drive sizes | Accurate within reason |
| Bus types | USB shows "USB", internal shows "SATA"/"NVMe" |

---

### Test 3: Clear Wipe Simulation

**Goal:** Verify Clear wipe flow works without destroying data.

**Steps:**
1. Select a USB drive
2. Choose "Zero Fill (1 pass)" method
3. Click "Start Wipe"
4. Click "Yes" on confirmation dialog
5. Watch progress bar
6. Wait for completion
7. Click "Generate Certificate"

**Expected UI States:**

| Phase | Status Display | Progress |
|-------|---------------|----------|
| Before start | "Ready to start" | 0% |
| During wipe | "Wipe in progress..." | 1-99% |
| Completed | "Wipe completed successfully" | 100% |

**Certificate Check:**
- Open `certificates/` folder
- Find newest `.json` file
- Verify contents include:
  - `device_info` with correct serial/model
  - `erase_method`: "Zero Fill (1 pass)"
  - `nist_profile`: "Clear" or "Purge"
  - `post_wipe_status`: "success"

---

### Test 4: Purge Failure on USB (Critical Test)

**Goal:** Verify purge fails gracefully on USB with proper messaging.

**Steps:**
1. Connect USB flash drive
2. Select the USB drive in dropdown
3. Choose "NIST 800-88 (1 pass)" method
4. Click "Start Wipe"
5. Confirm the warning dialog
6. Observe the result

**Expected Outcomes:**

```
✅ PASS: Error message explains USB limitation
✅ PASS: Suggests fallback (Clear or Destroy)
✅ PASS: App remains stable
✅ PASS: No certificate generated for failed purge

❌ FAIL: App crashes
❌ FAIL: Shows "Purge Successful" 
❌ FAIL: Silent failure
❌ FAIL: Cryptic error code
```

**Sample Expected Error Message:**
```
Purge Not Available

This device does not support Purge operations via its current 
interface. USB-connected devices typically cannot receive ATA 
Secure Erase or equivalent commands.

Alternative: You may perform a Clear operation, which overwrites 
all data with zeros or random patterns.

[Perform Clear]  [Cancel]
```

---

### Test 5: Error Handling Without Admin

**Goal:** Verify proper error when not running as admin.

**Steps:**
1. Close DropDrive
2. Open regular (non-admin) terminal
3. Run `npm run electron:dev`
4. Try to start a wipe operation

**Expected:**
```
Error: Administrator privileges required to access device.
Please restart DropDrive as Administrator.
```

**Pass Criteria:**
- [ ] Clear error message about permissions
- [ ] No crash or hang
- [ ] Suggests running as admin

---

### Test 6: Cancel Operation

**Goal:** Verify wipe can be cancelled cleanly.

**Steps:**
1. Start any wipe operation
2. While in progress, click "Stop Wipe"
3. Observe the result

**Expected:**
- Progress stops
- Status shows "Wipe operation cancelled"
- No certificate generated
- App remains stable

---

## 📊 Interpreting Results

### Status Messages

| Status | Meaning | Action Needed |
|--------|---------|---------------|
| "Ready to start" | Idle, waiting for user | Select drive and method |
| "Wipe in progress..." | Active operation | Wait or cancel |
| "Wipe completed successfully" | Done | Generate certificate |
| "Error: ..." | Something went wrong | Read error, try again |
| "Wipe operation cancelled" | User cancelled | Restart if needed |

### Certificate Interpretation

| Field | Possible Values | Meaning |
|-------|----------------|---------|
| `nist_profile` | "Clear" | Overwrite performed |
| `nist_profile` | "Purge" | Hardware erase performed |
| `nist_profile` | "Purge (Simulated)" | Dry run, no data changed |
| `post_wipe_status` | "success" | Operation completed |
| `post_wipe_status` | "failure" | Operation failed |

### Log Analysis

Logs appear in the UI during wipe. Key entries:

```
✅ Good:
[10:30:01] Wipe started for \\.\PhysicalDrive2 using nist-800
[10:30:02] Writing zeros to device...
[10:35:47] Wipe operation completed successfully

⚠️ Expected Failures (USB):
[10:30:01] Attempting ATA Secure Erase...
[10:30:01] ERROR: Command rejected by USB controller
[10:30:02] Purge not supported on this interface

❌ Real Problems:
[10:30:01] ERROR: Access denied
[10:30:01] ERROR: Device not found
```

---

## 🔧 Troubleshooting

### Problem: "Failed to load native addon"

**Solution:**
```bash
cd native
npx node-gyp rebuild
```

If still failing:
```bash
# Check for build tools
npm config set msvs_version 2022  # or 2019
npx node-gyp rebuild
```

---

### Problem: "No drives appear in dropdown"

**Possible Causes:**
1. Not running as admin
2. Drives not mounted
3. deviceManager.js error

**Solution:**
1. Run as Administrator
2. Check drives exist in Disk Management
3. Check console for errors (`Ctrl+Shift+I` → Console)

---

### Problem: "Purge unexpectedly succeeded on USB"

**This is a BUG!** USB should never report purge success.

**Action:**
1. Document the exact USB drive model
2. Check if really a USB (not USB-attached SATA)
3. Report as issue with device details

---

### Problem: "App crashes during wipe"

**Gather Info:**
1. Open DevTools: `Ctrl+Shift+I`
2. Go to Console tab
3. Note any red error messages
4. Check if native addon threw exception

**Common Causes:**
- Unhandled promise rejection
- Native addon segfault
- Memory issue with large drives

---

## 📋 Appendix: Test Checklist

Use this checklist to document your test results:

### Pre-Test Setup
- [ ] Node.js v18+ installed
- [ ] Native addon built successfully
- [ ] Running as Administrator
- [ ] USB drive connected (for USB tests)

### UI Tests

| Test | Status | Notes |
|------|--------|-------|
| App launches | ☐ Pass / ☐ Fail | |
| Test Addon succeeds | ☐ Pass / ☐ Fail | |
| Drives detected correctly | ☐ Pass / ☐ Fail | |
| Clear wipe works | ☐ Pass / ☐ Fail | |
| Progress bar updates | ☐ Pass / ☐ Fail | |
| Certificate generated | ☐ Pass / ☐ Fail | |
| Purge fails on USB | ☐ Pass / ☐ Fail | |
| Error message is clear | ☐ Pass / ☐ Fail | |
| Fallback suggested | ☐ Pass / ☐ Fail | |
| Cancel works | ☐ Pass / ☐ Fail | |
| No admin error shown | ☐ Pass / ☐ Fail | |

### Certificate Verification

| Check | Status |
|-------|--------|
| JSON file created | ☐ Yes / ☐ No |
| PDF file created | ☐ Yes / ☐ No |
| Device info correct | ☐ Yes / ☐ No |
| Method labeled correctly | ☐ Yes / ☐ No |
| No fake "Purge" claims | ☐ Yes / ☐ No |

### Overall Result

- [ ] **ALL TESTS PASSED** - Frontend is working correctly
- [ ] **SOME TESTS FAILED** - See notes, investigation needed
- [ ] **CRITICAL FAILURE** - App unusable, blocking issues found

---

## 📚 Related Documentation

| Document | Purpose |
|----------|---------|
| [UI_TESTING_FLOW.md](./UI_TESTING_FLOW.md) | Test case definitions and PASS criteria |
| [PURGE_TESTING_STRATEGY.md](./PURGE_TESTING_STRATEGY.md) | Three-level purge testing framework |
| [TESTING_GUIDE.md](./TESTING_GUIDE.md) | NIST 800-88 compliance and concepts |

---

**Document Version:** 1.0  
**Last Updated:** January 3, 2025  
**Author:** DropDrive Development Team
