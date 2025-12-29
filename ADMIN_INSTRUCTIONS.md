# Running DropDrive with Administrator Privileges

## Why Administrator Access is Required

Writing to physical drives (`\\.\PhysicalDriveX`) is a **privileged operation** on Windows. Without Administrator rights, you will get `Error 5: ACCESS_DENIED`.

## How to Run as Administrator

### Option 1: PowerShell (Recommended for testing)
1. **Close** your current PowerShell window
2. Press `Windows + X` and select **"Windows PowerShell (Admin)"** or **"Terminal (Admin)"**
3. Navigate to the project directory:
   ```powershell
   cd C:\Users\Hp\Desktop\Disk_cleaner\DropDrive_forked\electron
   ```
4. Run the test script:
   ```powershell
   node testPurgeDestroy.js
   ```

### Option 2: Command Prompt
1. Press `Windows + R`
2. Type `cmd` and press `Ctrl + Shift + Enter` (this opens as Admin)
3. Navigate and run:
   ```cmd
   cd C:\Users\Hp\Desktop\Disk_cleaner\DropDrive_forked\electron
   node testPurgeDestroy.js
   ```

### Option 3: Electron App (Production)
When packaging the final Electron app, you can:
1. Add a manifest file requesting elevated privileges
2. Use a helper tool to restart with elevation
3. Display a UAC prompt when the user attempts to wipe

## Verifying Administrator Mode
When you run the script with proper privileges, you should see:
- ✅ Device opened successfully
- ✅ Progress: X% - Speed: Y MB/s
- ✅ Wipe completed successfully

Instead of:
- ❌ ERROR: WriteFile failed with error: 5
