# DropDrive Project Workflow (A-Z)

## 1. Project Overview
DropDrive is a secure disk wiping utility designed to permanently erase data from storage devices (HDD, SSD, USB). It creates a "Addon" (native C++ module) linked to an Electron/Node.js frontend to perform low-level hardware operations.

## 2. Architecture

### Backend (Native Addon)
- **Language:** C++ (Windows API)
- **Location:** `/native`
- **Purpose:** Direct interaction with disk hardware.
- **Key Modules:**
  - `wipeAddon.cpp`: Main entry point, N-API wrapper.
  - `wipeMethods/purge/ataSecureErase.cpp`: Sends ATA Secure Erase commands (HDD/SSD).
  - `wipeMethods/purge/nvmeSanitize.cpp`: Sends NVMe Sanitize commands (NVMe SSDs).
  - `wipeMethods/purge/cryptoErase.cpp`: Manages cryptographic keys for instant erasure.
  - `wipeMethods/destroy.cpp`: Performs software-based overwrites (Gutmann) and destroys partition tables.

### Frontend/Middleware (Electron/Node)
- **Language:** JavaScript
- **Location:** `/electron`
- **Purpose:** User interface and logic to call the native addon.
- **Key Files:**
  - `main.js`: Electron main process.
  - `preload.js`: Bridge between UI and Node backend.
  - `testPurgeDestroy.js`: Diagnostic script for testing methods.

## 3. Wiping Flow (The "A-Z" Process)

### Step A: Device Detection
1. App scans for connected drives (`\\.\PhysicalDriveX`).
2. Identifies drive type:
   - **NVMe:** Supports `NVMe Sanitize`.
   - **ATA (SATA):** Supports `ATA Secure Erase`.
   - **USB/Generic:** Likely supports only `Software Wipe` (Clear) or `Destroy`.

### Step B: Method Selection
The appropriate wiping method depends on the drive type and security requirements.

| Method | Best For | Security Level | Speed |
| :--- | :--- | :--- | :--- |
| **Crypto Erase** | SED/NVMe | Purge (High) | Instant (< 10s) |
| **ATA Secure Erase** | SATA SSD/HDD | Purge (High) | Fast (minutes) |
| **NVMe Sanitize** | NVMe SSD | Purge (High) | Fast (minutes) |
| **Destroy** | Any (Failed Purge) | Destroy (Ultra) | Slow (Hours) |
| **Software Wipe** | USB / SD Cards | Clear (Medium) | Medium (Write Speed depend.) |

### Step C: Execution
1. **Purge Request:** User selects "Purge".
2. **Hardware Attempt:** App works down the list:
   - Try Crypto Erase.
   - If fail, try NVMe Sanitize.
   - If fail, try ATA Secure Erase.
3. **Fallback:** If all hardware commands fail (common with USB hubs/bridges), prompt user to use **Software Wipe** or **Destroy**.

### Step D: Verification
1. App polls drive status.
2. Returns Success/Failure result to UI.
3. Generates report.

## 4. Troubleshooting Support

### "Why isn't it working on my USB?"
Most USB flash drives use a "Bridge Controller" that translates USB signals to the flash memory. These controllers often **block** advanced ATA/NVMe commands like "Secure Erase" to prevent accidental bricking by consumers.
- **Solution:** Use the **Software Wipe** (`wipeFile`) or **Destroy** method. This writes zeros or random patterns directly to the sectors, bypassing the need for special controller commands.

## 5. Build & Development Workflow
1. **Modify C++ Code:** Edit files in `/native`.
2. **Rebuild Addon:**
   ```powershell
   cd native
   node-gyp rebuild
   ```
3. **Run Test Script:**
   ```powershell
   cd ..
   node electron/testPurgeDestroy.js
   ```
4. **Launch App:**
   ```powershell
   npm start
   ```
