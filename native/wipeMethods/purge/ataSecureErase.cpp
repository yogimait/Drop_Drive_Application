#include <windows.h>
#include <winioctl.h>
#include <ntddscsi.h>
#include <string>
#include <iostream>
#include <chrono>
#include <thread>
#include "purgeCommon.h"

// ATA command definitions
#define ATA_CMD_IDENTIFY_DEVICE       0xEC
#define ATA_CMD_SECURITY_SET_PASSWORD 0xF1
#define ATA_CMD_SECURITY_ERASE_PREPARE 0xF3
#define ATA_CMD_SECURITY_ERASE_UNIT    0xF4

// ATA IDENTIFY DEVICE offsets
#define ATA_ID_SECURITY_STATUS    128  // Word 128: Security status

// Security status bits
#define ATA_SECURITY_SUPPORTED    0x0001
#define ATA_SECURITY_ENABLED      0x0002
#define ATA_SECURITY_LOCKED       0x0004
#define ATA_SECURITY_FROZEN       0x0008
#define ATA_SECURITY_COUNT_EXPIRED 0x0010
#define ATA_SECURITY_ENHANCED_ERASE 0x0020

struct ATASecurityInfo {
    bool supported;
    bool enabled;
    bool locked;
    bool frozen;
    bool enhancedEraseSupported;
    uint16_t securityWord;
};

// Detect device type from storage properties
static DeviceType detectDeviceType(const std::string& drivePath) {
    HANDLE hDevice = CreateFileA(
        drivePath.c_str(),
        GENERIC_READ,
        FILE_SHARE_READ | FILE_SHARE_WRITE,
        NULL,
        OPEN_EXISTING,
        0,
        NULL
    );

    if (hDevice == INVALID_HANDLE_VALUE) {
        return DeviceType::UNKNOWN;
    }

    DeviceType result = DeviceType::UNKNOWN;

    // Query adapter properties for bus type
    STORAGE_PROPERTY_QUERY query;
    ZeroMemory(&query, sizeof(query));
    query.PropertyId = StorageAdapterProperty;
    query.QueryType = PropertyStandardQuery;

    BYTE adapterBuffer[1024];
    DWORD bytesReturned = 0;

    if (DeviceIoControl(hDevice,
                        IOCTL_STORAGE_QUERY_PROPERTY,
                        &query,
                        sizeof(query),
                        adapterBuffer,
                        sizeof(adapterBuffer),
                        &bytesReturned,
                        NULL)) {
        STORAGE_ADAPTER_DESCRIPTOR* adapter = (STORAGE_ADAPTER_DESCRIPTOR*)adapterBuffer;
        
        switch (adapter->BusType) {
            case BusTypeUsb:
                result = DeviceType::USB;
                break;
            case BusTypeNvme:
                result = DeviceType::NVME;
                break;
            case BusTypeAta:
            case BusTypeSata:
            case BusTypeAtapi:
                // Need to determine if SSD or HDD
                result = DeviceType::SATA_HDD;  // Default, will refine below
                break;
            case BusTypeScsi:
            case BusTypeSas:
                result = DeviceType::SCSI;
                break;
            default:
                result = DeviceType::UNKNOWN;
                break;
        }
    }

    // Try to detect SSD vs HDD for SATA devices
    if (result == DeviceType::SATA_HDD) {
        ZeroMemory(&query, sizeof(query));
        query.PropertyId = StorageDeviceSeekPenaltyProperty;
        query.QueryType = PropertyStandardQuery;

        DEVICE_SEEK_PENALTY_DESCRIPTOR seekPenalty;
        if (DeviceIoControl(hDevice,
                            IOCTL_STORAGE_QUERY_PROPERTY,
                            &query,
                            sizeof(query),
                            &seekPenalty,
                            sizeof(seekPenalty),
                            &bytesReturned,
                            NULL)) {
            if (!seekPenalty.IncursSeekPenalty) {
                result = DeviceType::SATA_SSD;
            }
        }
    }

    CloseHandle(hDevice);
    return result;
}

// Get ATA security information (non-destructive query)
static ATASecurityInfo getATASecurityInfo(const std::string& drivePath) {
    ATASecurityInfo info = {false, false, false, false, false, 0};
    
    HANDLE hDevice = CreateFileA(
        drivePath.c_str(),
        GENERIC_READ | GENERIC_WRITE,
        FILE_SHARE_READ | FILE_SHARE_WRITE,
        NULL,
        OPEN_EXISTING,
        0,
        NULL
    );

    if (hDevice == INVALID_HANDLE_VALUE) {
        std::cerr << "Error opening drive for security info: " << GetLastError() << std::endl;
        return info;
    }

    // Prepare ATA IDENTIFY DEVICE command (this is a read-only query)
    struct {
        ATA_PASS_THROUGH_EX apt;
        BYTE buffer[512];
    } identifyData;

    ZeroMemory(&identifyData, sizeof(identifyData));
    identifyData.apt.Length = sizeof(ATA_PASS_THROUGH_EX);
    identifyData.apt.AtaFlags = ATA_FLAGS_DATA_IN;
    identifyData.apt.DataTransferLength = 512;
    identifyData.apt.TimeOutValue = 10;
    identifyData.apt.DataBufferOffset = sizeof(ATA_PASS_THROUGH_EX);
    identifyData.apt.CurrentTaskFile[6] = ATA_CMD_IDENTIFY_DEVICE;

    DWORD bytesReturned = 0;
    if (DeviceIoControl(hDevice,
                        IOCTL_ATA_PASS_THROUGH,
                        &identifyData,
                        sizeof(identifyData),
                        &identifyData,
                        sizeof(identifyData),
                        &bytesReturned,
                        NULL)) {
        
        // Extract security word (word 128)
        uint16_t* identifyWords = (uint16_t*)identifyData.buffer;
        info.securityWord = identifyWords[ATA_ID_SECURITY_STATUS];
        
        info.supported = (info.securityWord & ATA_SECURITY_SUPPORTED) != 0;
        info.enabled = (info.securityWord & ATA_SECURITY_ENABLED) != 0;
        info.locked = (info.securityWord & ATA_SECURITY_LOCKED) != 0;
        info.frozen = (info.securityWord & ATA_SECURITY_FROZEN) != 0;
        info.enhancedEraseSupported = (info.securityWord & ATA_SECURITY_ENHANCED_ERASE) != 0;
    }

    CloseHandle(hDevice);
    return info;
}

// Main ATA Secure Erase function with dryRun support
PurgeResult ataSecureErase(const std::string& drivePath, bool useEnhanced, bool dryRun) {
    PurgeResult result;
    result.devicePath = drivePath;
    result.method = useEnhanced ? PurgeMethod::ATA_SECURE_ERASE_ENHANCED : PurgeMethod::ATA_SECURE_ERASE;
    
    std::cout << "=== ATA Secure Erase ===" << std::endl;
    std::cout << "Drive: " << drivePath << std::endl;
    std::cout << "Mode: " << (useEnhanced ? "Enhanced" : "Normal") << std::endl;
    std::cout << "Dry Run: " << (dryRun ? "YES (no data will be erased)" : "NO (DESTRUCTIVE)") << std::endl;

    // Step 1: Detect device type
    result.deviceType = detectDeviceType(drivePath);
    std::cout << "Detected device type: " << deviceTypeToString(result.deviceType) << std::endl;

    // Step 2: Check if purge is supported for this device type
    if (!isPurgeSupported(result.deviceType)) {
        result.success = false;
        result.supported = false;
        result.executed = false;
        result.status = "unsupported";
        result.message = "ATA Secure Erase not supported for " + deviceTypeToString(result.deviceType) + " devices";
        result.reason = getUnsupportedReason(result.deviceType);
        std::cerr << "ERROR: " << result.message << std::endl;
        std::cerr << "Reason: " << result.reason << std::endl;
        return result;
    }

    // Step 3: Check ATA security capabilities (this is a non-destructive read)
    ATASecurityInfo secInfo = getATASecurityInfo(drivePath);
    
    std::cout << "Security Status:" << std::endl;
    std::cout << "  ATA Security Supported: " << secInfo.supported << std::endl;
    std::cout << "  Security Enabled: " << secInfo.enabled << std::endl;
    std::cout << "  Locked: " << secInfo.locked << std::endl;
    std::cout << "  Frozen: " << secInfo.frozen << std::endl;
    std::cout << "  Enhanced Erase Supported: " << secInfo.enhancedEraseSupported << std::endl;
    
    if (!secInfo.supported) {
        result.success = false;
        result.supported = false;
        result.executed = false;
        result.status = "unsupported";
        result.message = "Drive does not support ATA Secure Erase";
        result.reason = "ATA IDENTIFY DEVICE indicates security features are not supported";
        std::cerr << "ERROR: " << result.message << std::endl;
        return result;
    }

    // Check for blocking conditions
    if (secInfo.frozen) {
        result.success = false;
        result.supported = true;  // Supported but blocked
        result.executed = false;
        result.status = "blocked";
        result.message = "Drive is security frozen";
        result.reason = "Drive security is frozen by BIOS. Reboot or power cycle the drive to unfreeze.";
        std::cerr << "ERROR: " << result.message << std::endl;
        return result;
    }

    if (secInfo.locked) {
        result.success = false;
        result.supported = true;
        result.executed = false;
        result.status = "blocked";
        result.message = "Drive is locked";
        result.reason = "Drive has an active security password and is locked.";
        std::cerr << "ERROR: " << result.message << std::endl;
        return result;
    }

    if (useEnhanced && !secInfo.enhancedEraseSupported) {
        std::cout << "WARNING: Enhanced erase not supported. Using normal erase." << std::endl;
        useEnhanced = false;
        result.method = PurgeMethod::ATA_SECURE_ERASE;
    }

    // DRY RUN: Return success without executing destructive commands
    if (dryRun) {
        result.success = true;
        result.supported = true;
        result.executed = false;  // No actual erase performed
        result.status = "dry_run";
        result.message = "ATA Secure Erase is SUPPORTED for this device (dry run - no data erased)";
        result.reason = "Dry run mode: Device capability verified. No destructive commands sent.";
        
        std::cout << "\n=== DRY RUN COMPLETE ===" << std::endl;
        std::cout << "Result: " << result.message << std::endl;
        std::cout << "Device Type: " << deviceTypeToString(result.deviceType) << std::endl;
        std::cout << "Method: " << purgeMethodToString(result.method) << std::endl;
        std::cout << "Enhanced Erase Available: " << secInfo.enhancedEraseSupported << std::endl;
        std::cout << "NO DATA WAS ERASED - This was a simulation." << std::endl;
        
        return result;
    }

    // ============================================
    // DESTRUCTIVE OPERATIONS BELOW - NOT DRY RUN
    // ============================================
    
    std::cout << "\n!!! EXECUTING DESTRUCTIVE OPERATION !!!" << std::endl;

    // Open device for writing
    HANDLE hDevice = CreateFileA(
        drivePath.c_str(),
        GENERIC_READ | GENERIC_WRITE,
        FILE_SHARE_READ | FILE_SHARE_WRITE,
        NULL,
        OPEN_EXISTING,
        0,
        NULL
    );

    if (hDevice == INVALID_HANDLE_VALUE) {
        result.success = false;
        result.supported = true;
        result.executed = false;
        result.status = "error";
        result.errorCode = GetLastError();
        result.message = "Failed to open drive";
        result.reason = "CreateFile failed with error code " + std::to_string(result.errorCode);
        std::cerr << "ERROR: " << result.message << std::endl;
        return result;
    }

    // Password buffer (all zeros for initial secure erase)
    BYTE passwordBuffer[512] = {0};
    passwordBuffer[0] = 0;  // User level

    struct {
        ATA_PASS_THROUGH_EX apt;
        BYTE buffer[512];
    } commandData;

    DWORD bytesReturned = 0;

    // Step 1: SECURITY SET PASSWORD
    std::cout << "Step 1: Setting security password..." << std::endl;
    ZeroMemory(&commandData, sizeof(commandData));
    memcpy(commandData.buffer, passwordBuffer, 512);
    
    commandData.apt.Length = sizeof(ATA_PASS_THROUGH_EX);
    commandData.apt.AtaFlags = ATA_FLAGS_DATA_OUT;
    commandData.apt.DataTransferLength = 512;
    commandData.apt.TimeOutValue = 15;
    commandData.apt.DataBufferOffset = sizeof(ATA_PASS_THROUGH_EX);
    commandData.apt.CurrentTaskFile[6] = ATA_CMD_SECURITY_SET_PASSWORD;

    if (!DeviceIoControl(hDevice, IOCTL_ATA_PASS_THROUGH,
                         &commandData, sizeof(commandData),
                         &commandData, sizeof(commandData),
                         &bytesReturned, NULL)) {
        result.success = false;
        result.supported = true;
        result.executed = false;
        result.status = "error";
        result.errorCode = GetLastError();
        result.message = "SECURITY SET PASSWORD failed";
        result.reason = "Error code " + std::to_string(result.errorCode);
        CloseHandle(hDevice);
        return result;
    }

    // Step 2: SECURITY ERASE PREPARE
    std::cout << "Step 2: Erase prepare..." << std::endl;
    ZeroMemory(&commandData, sizeof(commandData));
    
    commandData.apt.Length = sizeof(ATA_PASS_THROUGH_EX);
    commandData.apt.AtaFlags = ATA_FLAGS_DATA_OUT;
    commandData.apt.DataTransferLength = 0;
    commandData.apt.TimeOutValue = 10;
    commandData.apt.DataBufferOffset = 0;
    commandData.apt.CurrentTaskFile[6] = ATA_CMD_SECURITY_ERASE_PREPARE;

    if (!DeviceIoControl(hDevice, IOCTL_ATA_PASS_THROUGH,
                         &commandData, sizeof(ATA_PASS_THROUGH_EX),
                         &commandData, sizeof(ATA_PASS_THROUGH_EX),
                         &bytesReturned, NULL)) {
        result.success = false;
        result.supported = true;
        result.executed = false;
        result.status = "error";
        result.errorCode = GetLastError();
        result.message = "SECURITY ERASE PREPARE failed";
        result.reason = "Error code " + std::to_string(result.errorCode);
        CloseHandle(hDevice);
        return result;
    }

    // Step 3: SECURITY ERASE UNIT
    std::cout << "Step 3: Executing secure erase..." << std::endl;
    std::cout << "WARNING: This may take hours. DO NOT interrupt!" << std::endl;

    ZeroMemory(&commandData, sizeof(commandData));
    memcpy(commandData.buffer, passwordBuffer, 512);
    
    if (useEnhanced) {
        commandData.buffer[0] = 0x02;  // Enhanced erase
    }
    
    commandData.apt.Length = sizeof(ATA_PASS_THROUGH_EX);
    commandData.apt.AtaFlags = ATA_FLAGS_DATA_OUT;
    commandData.apt.DataTransferLength = 512;
    commandData.apt.TimeOutValue = 60 * 60 * 4; // 4 hours max
    commandData.apt.DataBufferOffset = sizeof(ATA_PASS_THROUGH_EX);
    commandData.apt.CurrentTaskFile[6] = ATA_CMD_SECURITY_ERASE_UNIT;

    auto startTime = std::chrono::high_resolution_clock::now();

    if (!DeviceIoControl(hDevice, IOCTL_ATA_PASS_THROUGH,
                         &commandData, sizeof(commandData),
                         &commandData, sizeof(commandData),
                         &bytesReturned, NULL)) {
        result.success = false;
        result.supported = true;
        result.executed = true;  // We attempted execution
        result.status = "error";
        result.errorCode = GetLastError();
        result.message = "SECURITY ERASE UNIT failed";
        result.reason = "Error code " + std::to_string(result.errorCode);
        CloseHandle(hDevice);
        return result;
    }

    auto endTime = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::seconds>(endTime - startTime).count();

    CloseHandle(hDevice);

    result.success = true;
    result.supported = true;
    result.executed = true;
    result.status = "success";
    result.message = "ATA Secure Erase completed successfully";
    result.reason = "Completed in " + std::to_string(duration) + " seconds";

    std::cout << "\n=== SECURE ERASE COMPLETE ===" << std::endl;
    std::cout << "Time taken: " << duration << " seconds (" << (duration / 60) << " minutes)" << std::endl;

    return result;
}

// Backward compatibility wrapper (returns bool)
bool ataSecureEraseLegacy(const std::string& drivePath, bool useEnhanced) {
    PurgeResult result = ataSecureErase(drivePath, useEnhanced, false);
    return result.success;
}

// Export for testing
#ifdef TEST_STANDALONE
int main() {
    std::string testDrive = "\\\\.\\PhysicalDrive1";
    
    std::cout << "=== ATA Secure Erase Test ===" << std::endl;
    std::cout << "Testing drive: " << testDrive << std::endl << std::endl;
    
    // First, run in dry-run mode (safe)
    std::cout << "--- DRY RUN (safe) ---" << std::endl;
    PurgeResult dryResult = ataSecureErase(testDrive, false, true);
    std::cout << "\nDry Run Result:" << std::endl;
    std::cout << "  Status: " << dryResult.status << std::endl;
    std::cout << "  Supported: " << dryResult.supported << std::endl;
    std::cout << "  Executed: " << dryResult.executed << std::endl;
    std::cout << "  Device Type: " << deviceTypeToString(dryResult.deviceType) << std::endl;
    std::cout << "  Message: " << dryResult.message << std::endl;
    
    return 0;
}
#endif
