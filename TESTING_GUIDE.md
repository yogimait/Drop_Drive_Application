# DropDrive Purge Testing Guide

> **Official Testing Documentation for NIST 800-88 Purge Operations**

---

## Table of Contents

1. [Understanding NIST 800-88 Purge](#understanding-nist-800-88-purge)
2. [Why Most USB Devices Cannot Be Purged](#why-most-usb-devices-cannot-be-purged)
3. [Failure ≠ Bug: Understanding Expected Behavior](#failure--bug-understanding-expected-behavior)
4. [Safety Rules for Testing](#safety-rules-for-testing)
5. [Certificate Labeling Rules](#certificate-labeling-rules)
6. [Test Outcomes and Interpretation](#test-outcomes-and-interpretation)
7. [Compliance Language Guidelines](#compliance-language-guidelines)

---

## Understanding NIST 800-88 Purge

### What is Purge?

According to **NIST Special Publication 800-88 Rev. 1** ("Guidelines for Media Sanitization"), **Purge** is defined as:

> *"A physical or logical technique that renders Target Data recovery infeasible using state-of-the-art laboratory techniques."*

This is fundamentally different from **Clear** (overwriting with zeros/random data):

| Sanitization Level | Definition | Recovery Resistance |
|-------------------|------------|---------------------|
| **Clear** | Overwrite with non-sensitive data | Resists keyboard attacks and simple data recovery tools |
| **Purge** | Renders data infeasible to recover | Resists state-of-the-art laboratory techniques |
| **Destroy** | Physical destruction | Complete media destruction |

### How Purge Actually Works

True Purge operations require **direct access to the storage controller firmware** to execute manufacturer-specific commands:

- **ATA Secure Erase** – For SATA/IDE drives
- **ATA Enhanced Secure Erase** – For SSDs with encryption
- **NVMe Format** – For NVMe drives with cryptographic erase
- **SCSI SANITIZE** – For enterprise SAS drives
- **Block Erase / Cryptographic Erase** – For self-encrypting drives (SEDs)

> [!IMPORTANT]
> **Purge is NOT multi-pass overwriting.** Writing zeros 35 times is still **Clear**, not Purge. The distinction is about the *mechanism*, not the *effort*.

---

## Why Most USB Devices Cannot Be Purged

### The Technical Reality

Most USB flash drives and external HDDs connected via USB **do not support Purge commands** because:

1. **USB Mass Storage Protocol Limitation**
   - USB Mass Storage Class (MSC) uses a simplified SCSI command set
   - ATA Secure Erase and SANITIZE commands are **not transmitted** through USB-to-SATA bridges
   - The USB controller intercepts and translates commands, blocking low-level operations

2. **Controller Firmware Restrictions**
   - USB flash drive controllers typically do not implement secure erase
   - Even if the NAND flash supports it, the controller doesn't expose the capability
   - No standardized "USB Secure Erase" command exists

3. **Bridge Chip Blocking**
   - External USB HDDs use USB-SATA bridge chips (e.g., ASMedia, JMicron)
   - These bridges block ATA security commands for safety reasons
   - Some bridges can be put in "passthrough" mode, but this is rare and risky

### What This Means for DropDrive

```
┌─────────────────────────────────────────────────────────────┐
│  Attempting Purge on USB Device                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  DropDrive → USB Controller → [BLOCKED] → Drive Firmware   │
│                    │                                        │
│                    └── ATA Secure Erase command rejected    │
│                                                             │
│  Result: PURGE FAILED (Expected Behavior)                   │
│  Fallback: Clear operation (overwrite) still possible       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

> [!NOTE]
> **This is not a bug.** DropDrive correctly reports that Purge is unavailable when the hardware doesn't support it. This is honest, compliant behavior.

---

## Failure ≠ Bug: Understanding Expected Behavior

### When "Failure" Is Correct

A Purge operation "failing" on a USB device is **expected and correct behavior**. Consider these scenarios:

| Scenario | Purge Result | Is This a Bug? | Why? |
|----------|--------------|----------------|------|
| USB flash drive | ❌ Failed | **No** | USB MSC doesn't support ATA Secure Erase |
| External USB HDD | ❌ Failed | **No** | USB-SATA bridge blocks security commands |
| Internal SATA SSD | ✅ Success | N/A | Direct SATA connection supports commands |
| NVMe SSD | ✅ Success | N/A | NVMe Format command available |
| Old USB drive (no controller) | ❌ Failed | **No** | Hardware limitation, not software |

### What Would Be a Bug?

The following scenarios **would** indicate bugs in DropDrive:

- ❌ Reporting "Purge Successful" when no ATA command was executed
- ❌ Crashing instead of gracefully handling unsupported operations
- ❌ Issuing a certificate labeled "Purge" when only Clear was performed
- ❌ Not attempting Purge at all on capable hardware
- ❌ Corrupting the device without proper error handling

### Correct DropDrive Behavior

```
User requests: Purge on USB drive
    │
    ├── DropDrive attempts ATA Secure Erase
    │       │
    │       └── USB controller rejects command
    │               │
    │               ├── DropDrive detects failure
    │               │
    │               ├── Logs: "Purge not supported on this device"
    │               │
    │               ├── Offers fallback: "Would you like to perform Clear instead?"
    │               │
    │               └── If Clear performed → Certificate says "Clear" (NOT Purge)
    │
    └── This is CORRECT, COMPLIANT behavior
```

---

## Safety Rules for Testing

> [!CAUTION]
> **Data destruction is irreversible.** Follow these rules to prevent catastrophic data loss during development and testing.

### Rule 1: Never Test on OS Drives

```
❌ NEVER target:
   • C:\ (Windows system drive)
   • / or /home (Linux root/home partitions)
   • Any drive containing your operating system
   • Any drive with data you need

✅ ALWAYS verify the target drive BEFORE any wipe operation
```

**Why this matters:** A wipe operation on your OS drive will render your system unbootable. There is no "undo" button.

### Rule 2: Use Only Expendable Devices

Before testing, acquire dedicated test media:

| Recommended Test Devices | Capacity | Purpose |
|--------------------------|----------|---------|
| Cheap USB flash drives | 4-16 GB | Quick Clear/Purge testing |
| Old external HDDs | Any | Full wipe cycle testing |
| Spare SSDs | Any | ATA Secure Erase testing |
| Virtual disk images | Any | Safe dryRun development |

> [!TIP]
> Label your test devices clearly: **"TEST ONLY - WIPE OK"**

### Rule 3: Prefer dryRun for Development

During development, **always use dryRun mode** unless testing actual wipe functionality:

```javascript
// ✅ Safe development testing
const result = await startWipe({
  device: targetDevice,
  method: 'purge',
  dryRun: true  // No actual writes occur
});

// ❌ Only for final validation on expendable devices
const result = await startWipe({
  device: targetDevice,
  method: 'purge',
  dryRun: false  // REAL DESTRUCTIVE OPERATION
});
```

### Rule 4: Triple-Check Before Execution

Before any non-dryRun wipe:

1. **Verify device path** – Is this really the test device?
2. **Check capacity** – Does the size match your test drive?
3. **Confirm emptiness** – Is there any important data on it?
4. **Disconnect other drives** – Minimize risk of wrong-target errors

### Rule 5: Development Environment Isolation

```
Recommended setup:
┌─────────────────────────────────────────┐
│  Development Machine                    │
│  ├── OS Drive (C:) - NEVER TARGET      │
│  ├── Data Drive (D:) - NEVER TARGET    │
│  └── USB Port → Test Device ONLY       │
│                                         │
│  All other drives disconnected during   │
│  wipe testing sessions                  │
└─────────────────────────────────────────┘
```

---

## Certificate Labeling Rules

> [!IMPORTANT]
> **Certificate integrity is paramount.** Mislabeled certificates undermine compliance and trust. DropDrive must never claim a sanitization level that wasn't achieved.

### Certificate Label Decision Tree

```
Was Purge command (ATA Secure Erase, NVMe Format, etc.) executed successfully?
    │
    ├── YES → Certificate Label: "Purge"
    │         NIST Profile: "Purge"
    │         Method: "ATA Secure Erase" / "NVMe Format" / etc.
    │
    └── NO → Was this a dryRun simulation?
              │
              ├── YES → Certificate Label: "Purge (Simulated)"
              │         NIST Profile: "Purge (Simulated - No Data Modified)"
              │         Method: "DryRun - No actual sanitization"
              │
              └── NO → Was a fallback Clear operation performed?
                        │
                        ├── YES → Certificate Label: "Clear"
                        │         NIST Profile: "Clear"
                        │         Method: "Overwrite" / "Zero Fill" / etc.
                        │         Note: "Purge not supported; Clear performed"
                        │
                        └── NO → Was physical destruction performed?
                                  │
                                  ├── YES → Certificate Label: "Destroy"
                                  │
                                  └── NO → NO CERTIFICATE ISSUED
                                            Operation: Failed/Incomplete
```

### Label Definitions

| Certificate Label | When to Use | NIST Compliance |
|-------------------|-------------|-----------------|
| **Purge** | ATA Secure Erase, NVMe Format, or equivalent executed and verified | Meets NIST 800-88 Purge |
| **Purge (Simulated)** | dryRun mode; no actual sanitization occurred | NOT compliant; for testing only |
| **Clear** | Overwrite operation completed; Purge not available or not attempted | Meets NIST 800-88 Clear |
| **Destroy** | Physical destruction documented | Meets NIST 800-88 Destroy |
| **No Certificate** | Operation failed or incomplete | No claim made |

### What to NEVER Do

```
❌ NEVER label as "Purge" when:
   • Only overwrite (Clear) was performed
   • Purge command failed and fell back to Clear
   • dryRun was used (use "Purge (Simulated)" instead)
   • Operation was incomplete or errored

❌ NEVER issue a certificate when:
   • The operation did not complete successfully
   • The target device could not be verified
   • The method used is unknown or unverified
```

### Certificate Field Requirements

Every DropDrive certificate must include:

```json
{
  "certificate_id": "uuid",
  "timestamp_utc": "ISO-8601 timestamp",
  "sanitization_level": "Clear | Purge | Purge (Simulated) | Destroy",
  "method_attempted": "What was tried",
  "method_executed": "What actually happened",
  "device_info": {
    "serial": "If available",
    "model": "Device model",
    "capacity": "Size",
    "interface": "USB | SATA | NVMe | etc."
  },
  "purge_supported": true | false,
  "purge_attempted": true | false,
  "purge_succeeded": true | false,
  "fallback_used": true | false,
  "fallback_method": "Clear | None",
  "verification_performed": true | false,
  "notes": "Any relevant context"
}
```

---

## Test Outcomes and Interpretation

### Example Test Scenarios

#### Scenario 1: USB Flash Drive - Purge Attempted

```
Device: SanDisk Cruzer 16GB (USB 3.0)
Interface: USB Mass Storage
Requested Method: Purge

Test Execution:
  [14:30:01] Attempting ATA Secure Erase...
  [14:30:01] Sending SECURITY_SET_PASSWORD command
  [14:30:01] ERROR: Command rejected by USB controller
  [14:30:01] Purge not supported on this interface
  [14:30:02] Prompting user for fallback option...
  [14:30:15] User selected: Clear (Zero Fill)
  [14:30:15] Beginning Clear operation...
  [14:45:30] Clear completed successfully

Result:
  ✅ EXPECTED BEHAVIOR
  Certificate Issued: Clear
  Notes: "Purge not supported via USB interface; Clear performed as fallback"
```

**Interpretation:** This is correct. USB flash drives cannot be purged. DropDrive correctly detected the limitation, offered a fallback, and issued an honest certificate.

---

#### Scenario 2: Internal SATA SSD - Purge Successful

```
Device: Samsung 860 EVO 500GB
Interface: SATA (direct connection)
Requested Method: Purge

Test Execution:
  [14:30:01] Attempting ATA Secure Erase...
  [14:30:01] Sending SECURITY_SET_PASSWORD command
  [14:30:01] Command accepted
  [14:30:02] Sending SECURITY_ERASE_UNIT command
  [14:30:02] Drive firmware executing secure erase...
  [14:32:45] Secure erase completed
  [14:32:45] Verifying erase status...
  [14:32:46] Verification passed

Result:
  ✅ PURGE SUCCESSFUL
  Certificate Issued: Purge
  Method: ATA Secure Erase
  Notes: "Purge completed successfully via ATA Secure Erase"
```

**Interpretation:** SATA SSDs support ATA Secure Erase when directly connected. This is a valid Purge operation.

---

#### Scenario 3: USB External HDD - Purge Failed, No Fallback

```
Device: Seagate Expansion 2TB (USB 3.0)
Interface: USB Mass Storage (with SATA bridge)
Requested Method: Purge

Test Execution:
  [14:30:01] Attempting ATA Secure Erase...
  [14:30:01] Sending SECURITY_SET_PASSWORD command
  [14:30:01] ERROR: USB-SATA bridge blocked command
  [14:30:01] Purge not supported on this interface
  [14:30:02] Prompting user for fallback option...
  [14:30:10] User selected: Cancel operation

Result:
  ✅ EXPECTED BEHAVIOR
  Certificate Issued: NONE
  Notes: Operation cancelled by user; no sanitization performed
```

**Interpretation:** User declined fallback. No certificate is issued because no sanitization occurred. This is correct.

---

#### Scenario 4: Development Testing with dryRun

```
Device: Test Device (simulated)
Interface: Virtual
Requested Method: Purge
Mode: dryRun = true

Test Execution:
  [14:30:01] DRY RUN MODE - No actual writes will occur
  [14:30:01] Simulating Purge operation...
  [14:30:01] Would attempt: ATA Secure Erase
  [14:30:02] Simulation complete

Result:
  ✅ EXPECTED BEHAVIOR
  Certificate Issued: Purge (Simulated)
  Notes: "DRY RUN - No data was modified. For testing purposes only."
```

**Interpretation:** dryRun certificates are clearly marked as simulations and explicitly state no data was modified.

---

#### Scenario 5: NVMe SSD - Purge via Format Command

```
Device: WD Black SN750 1TB
Interface: NVMe (PCIe)
Requested Method: Purge

Test Execution:
  [14:30:01] Detecting NVMe capabilities...
  [14:30:01] NVMe Format with Secure Erase supported
  [14:30:02] Sending NVMe Format command (SES=1)...
  [14:30:02] Drive firmware executing cryptographic erase...
  [14:30:08] Format completed
  [14:30:08] Verifying namespace status...
  [14:30:09] Verification passed

Result:
  ✅ PURGE SUCCESSFUL
  Certificate Issued: Purge
  Method: NVMe Format (Cryptographic Erase)
  Notes: "Purge completed successfully via NVMe Format command"
```

**Interpretation:** NVMe drives support Purge through the Format command with Secure Erase Settings (SES). This is a valid Purge.

---

### Quick Reference: Outcome Matrix

| Device Type | Interface | Purge Support | Expected Outcome |
|-------------|-----------|---------------|------------------|
| USB Flash Drive | USB MSC | ❌ No | Purge fails → Offer Clear |
| USB External HDD | USB MSC + Bridge | ❌ No | Purge fails → Offer Clear |
| Internal SATA HDD | SATA | ✅ Yes | Purge via ATA Secure Erase |
| Internal SATA SSD | SATA | ✅ Yes | Purge via ATA Secure Erase |
| NVMe SSD | PCIe | ✅ Yes | Purge via NVMe Format |
| SD Card | SD/MMC | ❌ No | Purge fails → Offer Clear |
| Enterprise SAS | SAS | ✅ Yes | Purge via SCSI SANITIZE |

---

## Compliance Language Guidelines

### Honest Reporting Principles

DropDrive adheres to these principles for all compliance claims:

1. **Never overstate capabilities**
   - If Purge fails, say "Purge not supported" — not "Purge failed due to error"
   - Distinguish between "cannot do" and "tried but failed"

2. **Never understate limitations**
   - USB devices cannot be purged via DropDrive — state this clearly
   - Don't hide limitations in fine print

3. **Use precise terminology**
   - "Clear" means overwrite
   - "Purge" means firmware-level secure erase
   - "Destroy" means physical destruction
   - Never conflate these terms

### Recommended Language for UI/Certificates

#### When Purge is NOT Supported

```
Title: "Purge Not Available"

Message: "This device does not support Purge operations via its current 
interface. USB-connected devices typically cannot receive ATA Secure Erase 
or equivalent commands.

Alternative: You may perform a Clear operation, which overwrites all data 
with zeros or random patterns. Clear meets NIST 800-88 requirements for 
many use cases but does not provide the same level of assurance as Purge."

Options: [Perform Clear] [Cancel]
```

#### When Purge Succeeds

```
Certificate Statement:
"This device was sanitized using [ATA Secure Erase / NVMe Format / etc.], 
which meets the NIST SP 800-88 Rev. 1 definition of Purge. Data recovery 
using state-of-the-art laboratory techniques is considered infeasible."
```

#### When Clear is Performed as Fallback

```
Certificate Statement:
"Purge was not available for this device due to interface limitations. 
A Clear operation was performed instead, overwriting all accessible 
storage with [zeros / random data]. This meets the NIST SP 800-88 Rev. 1 
definition of Clear. Data recovery may be possible using advanced 
laboratory techniques."
```

#### For dryRun/Simulated Operations

```
Certificate Header: "⚠️ SIMULATION ONLY - NOT A VALID SANITIZATION CERTIFICATE"

Statement:
"This certificate was generated in DRY RUN mode. NO DATA WAS MODIFIED OR 
DESTROYED. This document is for testing and development purposes only and 
does not represent any actual sanitization activity."
```

### Language to Avoid

| ❌ Avoid | ✅ Use Instead |
|----------|----------------|
| "Military-grade wipe" (vague) | "DoD 5220.22-M compliant Clear" (specific) |
| "Unrecoverable" (absolute) | "Recovery infeasible using current techniques" |
| "Completely secure" (unprovable) | "Meets NIST 800-88 [Clear/Purge] requirements" |
| "100% guaranteed" (liability risk) | "Performed according to [standard]" |
| "Purge performed" (when Clear was done) | "Clear performed (Purge not available)" |

---

## Summary

### Key Takeaways

1. **Purge ≠ Multi-pass overwrite** — Purge requires firmware-level commands
2. **USB devices cannot be purged** — This is a hardware limitation, not a bug
3. **Failure is expected** — DropDrive correctly reports when Purge isn't available
4. **Certificates must be honest** — Only label as "Purge" when Purge was executed
5. **Safety first** — Never test on production drives; use dryRun during development

### Compliance Philosophy

> DropDrive's value is in its **honesty**. We don't claim capabilities we don't have. 
> When Purge isn't possible, we say so clearly and offer appropriate alternatives. 
> This transparency builds trust and ensures our certificates are meaningful.

---

**Document Version:** 1.0.0  
**Last Updated:** December 2024  
**Applicable Standards:** NIST SP 800-88 Rev. 1

---

*This guide is part of official DropDrive documentation. For questions or corrections, contact the development team.*
