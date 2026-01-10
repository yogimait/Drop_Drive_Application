# DropDrive Frontend UI Testing Flow

> **Document Version:** 1.0  
> **Purpose:** Define a safe, UI-driven testing methodology without real hardware destruction  
> **Applies To:** DropDrive v0.1.0+

---

## 📋 Overview

This document defines the **official UI-driven testing flow** for DropDrive. It enables developers to thoroughly test frontend-backend integration from the UI without:
- Destroying actual data
- Requiring spare HDDs/SSDs
- Risking hardware damage

### Key Principle

> **Testing proves the UI behaves correctly even when operations fail.** A graceful failure is a successful test.

---

## 🎯 Testable Scenarios from UI

| Scenario | How to Test | Expected Behavior |
|----------|-------------|-------------------|
| **Clear Wipe** | Enable Test Mode → Start wipe | Simulated completion |
| **Dry-Run Purge** | Enable Test Mode → Select Purge → View capabilities | Show device support status |
| **Purge Failure on USB** | Select USB → Attempt Purge | Graceful failure + fallback |
| **Fallback Suggestion** | Trigger purge failure | UI suggests Clear/Destroy |
| **Error: Unsupported** | Attempt purge on USB | Human-readable error |
| **Error: Permission Denied** | Run without admin → Attempt wipe | Permission error message |

---

## ✅ What Counts as PASS

### Correct UI State

| Criterion | Pass If | Fail If |
|-----------|---------|---------|
| Drive selection | Shows all available drives | Drives missing or wrong |
| Method selection | Shows all wipe methods | Methods missing |
| Progress display | Updates during operation | Stuck or no updates |
| Status indicators | Reflects actual state | Shows wrong state |
| Test Mode indicator | Clearly visible when active | Hidden or unclear |

### No Crashes

| Criterion | Pass If | Fail If |
|-----------|---------|---------|
| Operation starts | UI remains responsive | App freezes or crashes |
| Operation fails | Error shown, UI stable | App crashes |
| Error handling | Graceful messages | Unhandled exception |
| Cancellation | Clean stop, UI reset | App hangs |

### Honest Messages

| Criterion | Pass If | Fail If |
|-----------|---------|---------|
| Error messages | Human-readable, explains *why* | Cryptic codes (e.g., "0x80070005") |
| Failure reason | Clear explanation | Silent failure |
| Fallback suggestion | Offers alternatives | No alternatives shown |
| Unsupported device | Explains limitation | Misleading message |

### No Fake Success

| Criterion | Pass If | Fail If |
|-----------|---------|---------|
| Simulated operation | Says "Simulated" or "Dry Run" | Says "Success" without qualifier |
| Failed operation | Says "Failed" with reason | Says "Success" |
| Unsupported purge | Says "Not Supported" | Says "Purge Complete" |
| Certificate label | Matches actual operation | Claims higher level than achieved |

---

## 📜 Certificate Labeling Requirements

Certificates must **honestly reflect** what happened:

### Simulation Mode Certificate

```
SANITIZATION CERTIFICATE (SIMULATION)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ SIMULATION ONLY - NO DATA WAS MODIFIED

This certificate was generated in DRY RUN mode.
This document is for testing purposes only and
does not represent any actual sanitization activity.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sanitization Level: Purge (Simulated)
Method Tested: ATA Secure Erase
Device Support: YES (would work on this device)
Data Modified: NO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Unsupported Hardware Certificate

```
SANITIZATION CERTIFICATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Sanitization Level: Clear (Fallback)

Note: Purge was not available for this device.
Reason: USB devices do not support ATA/NVMe commands.
Fallback: Clear (overwrite) was performed instead.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Method Attempted: ATA Secure Erase, NVMe Sanitize
Method Executed: Clear (Zero Fill)
Hardware Limitation: USB Mass Storage - No Purge Support
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Real Purge Certificate

```
SANITIZATION CERTIFICATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Sanitization Level: Purge
NIST 800-88 Compliance: YES

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Method Executed: ATA Secure Erase
Device: Samsung 860 EVO 500GB
Interface: SATA
Result: SUCCESS - Data recovery infeasible
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🧪 Test Case Procedures

### Test 1: Clear Wipe (Dry-Run)

**Goal:** Verify Clear wipe UI flow works correctly in simulation mode.

**Steps:**
1. Open DropDrive → Navigate to Wipe Process
2. Select any safe drive (USB recommended for testing)
3. Enable "Test Mode" toggle (if implemented, otherwise proceed normally)
4. Select "Zero Fill (1 pass)" method
5. Click "Start Wipe"
6. Confirm the warning dialog
7. Observe progress bar updates
8. Wait for completion
9. Click "Generate Certificate"
10. Open the generated certificate

**PASS Criteria:**
- [ ] Progress bar updates smoothly
- [ ] Status shows "Wipe in progress..." during operation
- [ ] Completion shows "Wipe completed successfully"
- [ ] Certificate is generated in `certificates/` folder
- [ ] Certificate shows correct method and device info
- [ ] No crashes at any point

---

### Test 2: Dry-Run Purge Test

**Goal:** Verify the system correctly identifies device purge capabilities.

**Steps:**
1. Open DropDrive → Navigate to Wipe Process
2. Click "Test Addon" button to verify native addon loads
3. Select a drive
4. Note the device type shown (USB, SATA, NVMe)
5. Observe what purge methods are reported as available

**PASS Criteria:**
- [ ] "Test Addon" shows success
- [ ] Device type accurately detected
- [ ] USB shows as not supporting purge
- [ ] Internal SATA/NVMe shows as supporting purge (if connected)

---

### Test 3: Purge Failure on USB

**Goal:** Verify graceful failure when attempting purge on USB.

**Steps:**
1. Connect a USB flash drive
2. Open DropDrive → Wipe Process
3. Select the USB drive
4. Configure purge-capable method (NIST 800-88)
5. Start the wipe
6. Observe the result

**PASS Criteria:**
- [ ] Purge attempt is made
- [ ] Failure is detected and reported
- [ ] Error message explains USB limitation
- [ ] Fallback to Clear is suggested
- [ ] App does NOT crash
- [ ] No certificate claims "Purge" succeeded

---

### Test 4: Fallback Suggestion

**Goal:** Verify fallback UI appears after purge failure.

**Steps:**
1. Trigger a purge failure (use USB as per Test 3)
2. Observe the fallback suggestion UI

**PASS Criteria:**
- [ ] Fallback panel/message appears
- [ ] Offers Clear as alternative
- [ ] Offers Destroy as alternative
- [ ] Explains why purge failed
- [ ] User can choose or cancel

---

### Test 5: Error Handling - Unsupported

**Goal:** Verify human-readable error for unsupported devices.

**Steps:**
1. Connect USB drive
2. Attempt purge operation
3. Read the error message

**PASS Criteria:**
- [ ] Error is NOT a raw Windows code (e.g., "0x80070005")
- [ ] Error explains the limitation
- [ ] Error suggests what to do instead
- [ ] Example: "Purge is not available for USB devices. USB drives use the Mass Storage protocol which cannot process ATA Secure Erase or NVMe commands. Try using Clear (overwrite) instead."

---

### Test 6: Error Handling - Permission Denied

**Goal:** Verify clear messaging when admin privileges missing.

**Steps:**
1. Close DropDrive if running
2. Start DropDrive WITHOUT "Run as Administrator"
3. Try to perform a wipe operation

**PASS Criteria:**
- [ ] Error message appears before or during wipe attempt
- [ ] Message mentions "Administrator" or "elevated privileges"
- [ ] App does NOT crash
- [ ] Suggests how to fix (restart as admin)

---

## 📊 Quick Reference Matrix

| Test | Target Device | Expected Outcome | Pass If |
|------|--------------|------------------|---------|
| Clear Dry-Run | Any | Simulated completion | Progress works, cert generated |
| Purge Dry-Run | Internal | Shows capability | Device type correct |
| Purge USB | USB | Graceful failure | Error + fallback shown |
| Fallback | Any failed purge | Alternatives offered | Clear/Destroy suggested |
| Unsupported | USB | Clear error | Human-readable message |
| Permission | Any | Clear error | Admin required message |

---

## 🔐 Certificate Truth Table

| What Happened | Certificate Should Say |
|--------------|----------------------|
| Real Clear completed | "Clear" |
| Real Purge completed | "Purge" |
| Simulated Clear | "Clear (Simulated)" |
| Simulated Purge | "Purge (Simulated)" |
| Purge failed, Clear fallback | "Clear" + fallback note |
| Purge failed, no fallback | NO CERTIFICATE ISSUED |
| Operation cancelled | NO CERTIFICATE ISSUED |

---

## 🚫 What NEVER to Do

1. **Never issue a "Purge" certificate when only Clear was done**
2. **Never show "Success" for a simulated operation without "(Simulated)"**
3. **Never hide error messages from the user**
4. **Never claim NIST Purge compliance on USB devices**
5. **Never generate certificates for failed/cancelled operations**

---

## 📎 Related Documents

- [PURGE_TESTING_STRATEGY.md](./PURGE_TESTING_STRATEGY.md) - Three-level testing framework
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Comprehensive NIST compliance guide
- [electron/testPurgeUSB.js](./electron/testPurgeUSB.js) - USB logic test script
- [electron/testPurgeDryRun.js](./electron/testPurgeDryRun.js) - Dry run test script

---

**Document Version:** 1.0  
**Last Updated:** January 3, 2025  
**Applies To:** DropDrive v0.1.0+
