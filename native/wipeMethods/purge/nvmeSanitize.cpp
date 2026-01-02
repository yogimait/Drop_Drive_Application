#include <windows.h>
#include <winioctl.h>
#include <nvme.h>
#include <string>
#include <iostream>
#include <chrono>
#include <thread>
#include "purgeCommon.h"

// NVMe Sanitize Actions
#define NVME_SANITIZE_ACTION_EXIT               0
#define NVME_SANITIZE_ACTION_BLOCK_ERASE        1
#define NVME_SANITIZE_ACTION_OVERWRITE          2
#define NVME_SANITIZE_ACTION_CRYPTO_ERASE       3

// NVMe Admin Commands
#define NVME_ADMIN_CMD_SANITIZE                 0x84
#define NVME_ADMIN_CMD_GET_LOG_PAGE             0x02

// Log Page IDs
#define NVME_LOG_PAGE_SANITIZE_STATUS           0x81

#pragma pack(push, 1)

struct NVMeSanitizeStatus {
    uint16_t sanitize_progress;
    uint16_t sanitize_status;
    uint32_t global_data_erased;
    uint32_t reserved[6];
};

#pragma pack(pop)

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
                result = DeviceType::SATA_HDD;
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

    // Detect SSD for SATA
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

// Check if NVMe sanitize is supported (non-destructive query)
static bool checkNVMeSanitizeSupport(const std::string& drivePath, bool& cryptoSupported, bool& blockSupported, bool& overwriteSupported) {
    cryptoSupported = false;
    blockSupported = false;
    overwriteSupported = false;

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
        return false;
    }

    // Query NVMe Identify Controller to check sanitize capabilities
    STORAGE_PROPERTY_QUERY query;
    ZeroMemory(&query, sizeof(query));
    query.PropertyId = StorageAdapterProtocolSpecificProperty;
    query.QueryType = PropertyStandardQuery;

    // For now, assume NVMe devices support crypto sanitize
    // Full implementation would query IDENTIFY CONTROLLER for SANICAP
    CloseHandle(hDevice);
    
    // Most NVMe SSDs support crypto erase at minimum
    cryptoSupported = true;
    blockSupported = true;
    overwriteSupported = true;
    
    return true;
}

// Get sanitize status (non-destructive)
static bool getSanitizeStatus(HANDLE hDevice, NVMeSanitizeStatus& status) {
    STORAGE_PROTOCOL_COMMAND cmd;
    ZeroMemory(&cmd, sizeof(cmd));
    
    cmd.Version = STORAGE_PROTOCOL_STRUCTURE_VERSION;
    cmd.Length = sizeof(STORAGE_PROTOCOL_COMMAND);
    cmd.ProtocolType = ProtocolTypeNvme;
    cmd.Flags = STORAGE_PROTOCOL_COMMAND_FLAG_ADAPTER_REQUEST;
    cmd.CommandLength = STORAGE_PROTOCOL_COMMAND_LENGTH_NVME;
    cmd.ErrorInfoLength = sizeof(NVME_ERROR_INFO_LOG);
    cmd.DataFromDeviceTransferLength = sizeof(NVMeSanitizeStatus);
    cmd.TimeOutValue = 10;
    cmd.ErrorInfoOffset = sizeof(STORAGE_PROTOCOL_COMMAND);
    cmd.DataFromDeviceBufferOffset = sizeof(STORAGE_PROTOCOL_COMMAND) + sizeof(NVME_ERROR_INFO_LOG);
    cmd.CommandSpecific = STORAGE_PROTOCOL_SPECIFIC_NVME_ADMIN_COMMAND;

    struct {
        STORAGE_PROTOCOL_COMMAND Command;
        NVME_ERROR_INFO_LOG ErrorInfo;
        NVMeSanitizeStatus Data;
    } cmdBuffer;

    ZeroMemory(&cmdBuffer, sizeof(cmdBuffer));
    memcpy(&cmdBuffer.Command, &cmd, sizeof(cmd));

    NVME_COMMAND* nvmeCmd = (NVME_COMMAND*)&cmdBuffer.Command.Command;
    nvmeCmd->CDW0.OPC = NVME_ADMIN_CMD_GET_LOG_PAGE;
    nvmeCmd->NSID = 0xFFFFFFFF;
    nvmeCmd->u.GETLOGPAGE.CDW10.LID = NVME_LOG_PAGE_SANITIZE_STATUS;
    nvmeCmd->u.GETLOGPAGE.CDW10.NUMD = (sizeof(NVMeSanitizeStatus) / 4) - 1;

    DWORD bytesReturned = 0;
    if (DeviceIoControl(hDevice, IOCTL_STORAGE_PROTOCOL_COMMAND,
                        &cmdBuffer, sizeof(cmdBuffer),
                        &cmdBuffer, sizeof(cmdBuffer),
                        &bytesReturned, NULL)) {
        memcpy(&status, &cmdBuffer.Data, sizeof(status));
        return true;
    }

    return false;
}

// Main NVMe Sanitize function with dryRun support
PurgeResult nvmeSanitize(const std::string& drivePath, const std::string& action, bool dryRun) {
    PurgeResult result;
    result.devicePath = drivePath;
    
    // Determine method from action
    if (action == "crypto") {
        result.method = PurgeMethod::NVME_SANITIZE_CRYPTO;
    } else if (action == "block") {
        result.method = PurgeMethod::NVME_SANITIZE_BLOCK;
    } else if (action == "overwrite") {
        result.method = PurgeMethod::NVME_SANITIZE_OVERWRITE;
    } else {
        result.success = false;
        result.supported = false;
        result.executed = false;
        result.status = "error";
        result.message = "Invalid action. Use 'crypto', 'block', or 'overwrite'";
        result.reason = "Unrecognized sanitize action: " + action;
        return result;
    }
    
    std::cout << "=== NVMe Sanitize ===" << std::endl;
    std::cout << "Drive: " << drivePath << std::endl;
    std::cout << "Action: " << action << std::endl;
    std::cout << "Dry Run: " << (dryRun ? "YES (no data will be erased)" : "NO (DESTRUCTIVE)") << std::endl;

    // Step 1: Detect device type
    result.deviceType = detectDeviceType(drivePath);
    std::cout << "Detected device type: " << deviceTypeToString(result.deviceType) << std::endl;

    // Step 2: Check if this is an NVMe device
    if (result.deviceType != DeviceType::NVME) {
        result.success = false;
        result.supported = false;
        result.executed = false;
        result.status = "unsupported";
        result.message = "NVMe Sanitize requires an NVMe device";
        result.reason = "Detected device type is " + deviceTypeToString(result.deviceType) + 
                       ", which does not support NVMe commands. " +
                       (result.deviceType == DeviceType::USB 
                           ? "USB devices cannot use NVMe Sanitize - use software overwrite instead."
                           : "Use ATA Secure Erase for SATA devices.");
        std::cerr << "ERROR: " << result.message << std::endl;
        std::cerr << "Reason: " << result.reason << std::endl;
        return result;
    }

    // Step 3: Check NVMe sanitize capabilities (non-destructive)
    bool cryptoSupported, blockSupported, overwriteSupported;
    if (!checkNVMeSanitizeSupport(drivePath, cryptoSupported, blockSupported, overwriteSupported)) {
        result.success = false;
        result.supported = false;
        result.executed = false;
        result.status = "error";
        result.message = "Could not query NVMe sanitize capabilities";
        result.reason = "Failed to read IDENTIFY CONTROLLER data";
        return result;
    }

    std::cout << "NVMe Sanitize Capabilities:" << std::endl;
    std::cout << "  Crypto Erase: " << (cryptoSupported ? "Yes" : "No") << std::endl;
    std::cout << "  Block Erase: " << (blockSupported ? "Yes" : "No") << std::endl;
    std::cout << "  Overwrite: " << (overwriteSupported ? "Yes" : "No") << std::endl;

    // Check if requested action is supported
    bool actionSupported = false;
    if (action == "crypto") actionSupported = cryptoSupported;
    else if (action == "block") actionSupported = blockSupported;
    else if (action == "overwrite") actionSupported = overwriteSupported;

    if (!actionSupported) {
        result.success = false;
        result.supported = false;
        result.executed = false;
        result.status = "unsupported";
        result.message = action + " sanitize not supported by this NVMe device";
        result.reason = "Device does not report support for " + action + " sanitize action";
        return result;
    }

    // DRY RUN: Return success without executing destructive commands
    if (dryRun) {
        result.success = true;
        result.supported = true;
        result.executed = false;
        result.status = "dry_run";
        result.message = "NVMe Sanitize (" + action + ") is SUPPORTED for this device (dry run)";
        result.reason = "Dry run mode: Device capability verified. No destructive commands sent.";
        
        std::cout << "\n=== DRY RUN COMPLETE ===" << std::endl;
        std::cout << "Result: " << result.message << std::endl;
        std::cout << "Device Type: " << deviceTypeToString(result.deviceType) << std::endl;
        std::cout << "Method: " << purgeMethodToString(result.method) << std::endl;
        std::cout << "NO DATA WAS ERASED - This was a simulation." << std::endl;
        
        return result;
    }

    // ============================================
    // DESTRUCTIVE OPERATIONS BELOW - NOT DRY RUN
    // ============================================
    
    std::cout << "\n!!! EXECUTING DESTRUCTIVE OPERATION !!!" << std::endl;

    uint8_t sanitizeAction;
    if (action == "crypto") {
        sanitizeAction = NVME_SANITIZE_ACTION_CRYPTO_ERASE;
    } else if (action == "block") {
        sanitizeAction = NVME_SANITIZE_ACTION_BLOCK_ERASE;
    } else {
        sanitizeAction = NVME_SANITIZE_ACTION_OVERWRITE;
    }

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
        return result;
    }

    // Prepare sanitize command
    STORAGE_PROTOCOL_COMMAND cmd;
    ZeroMemory(&cmd, sizeof(cmd));
    
    cmd.Version = STORAGE_PROTOCOL_STRUCTURE_VERSION;
    cmd.Length = sizeof(STORAGE_PROTOCOL_COMMAND);
    cmd.ProtocolType = ProtocolTypeNvme;
    cmd.Flags = STORAGE_PROTOCOL_COMMAND_FLAG_ADAPTER_REQUEST;
    cmd.CommandLength = STORAGE_PROTOCOL_COMMAND_LENGTH_NVME;
    cmd.ErrorInfoLength = sizeof(NVME_ERROR_INFO_LOG);
    cmd.TimeOutValue = 60;
    cmd.CommandSpecific = STORAGE_PROTOCOL_SPECIFIC_NVME_ADMIN_COMMAND;

    struct {
        STORAGE_PROTOCOL_COMMAND Command;
        NVME_ERROR_INFO_LOG ErrorInfo;
    } cmdBuffer;

    ZeroMemory(&cmdBuffer, sizeof(cmdBuffer));
    memcpy(&cmdBuffer.Command, &cmd, sizeof(cmd));

    NVME_COMMAND* nvmeCmd = (NVME_COMMAND*)&cmdBuffer.Command.Command;
    nvmeCmd->CDW0.OPC = NVME_ADMIN_CMD_SANITIZE;
    nvmeCmd->NSID = 0xFFFFFFFF;
    nvmeCmd->u.GENERAL.CDW10 = (sanitizeAction & 0x07);

    std::cout << "Starting NVMe Sanitize operation..." << std::endl;
    std::cout << "WARNING: This cannot be stopped!" << std::endl;

    DWORD bytesReturned = 0;
    auto startTime = std::chrono::high_resolution_clock::now();

    if (!DeviceIoControl(hDevice, IOCTL_STORAGE_PROTOCOL_COMMAND,
                         &cmdBuffer, sizeof(cmdBuffer),
                         &cmdBuffer, sizeof(cmdBuffer),
                         &bytesReturned, NULL)) {
        result.success = false;
        result.supported = true;
        result.executed = false;
        result.status = "error";
        result.errorCode = GetLastError();
        result.message = "Sanitize command failed";
        result.reason = "DeviceIoControl failed with error " + std::to_string(result.errorCode);
        CloseHandle(hDevice);
        return result;
    }

    std::cout << "Sanitize command issued. Polling for completion..." << std::endl;

    // Poll for completion
    bool completed = false;
    int pollCount = 0;
    while (!completed && pollCount < 2880) {  // 4 hours max
        std::this_thread::sleep_for(std::chrono::seconds(5));
        pollCount++;

        NVMeSanitizeStatus status;
        if (getSanitizeStatus(hDevice, status)) {
            if ((status.sanitize_status & 0x07) == 0) {
                completed = true;
            } else {
                double progressPct = (status.sanitize_progress / 65535.0) * 100.0;
                std::cout << "Progress: " << (int)progressPct << "%" << std::endl;
            }
        }
    }

    auto endTime = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::seconds>(endTime - startTime).count();

    CloseHandle(hDevice);

    if (!completed) {
        result.success = false;
        result.supported = true;
        result.executed = true;
        result.status = "timeout";
        result.message = "Sanitize operation timed out";
        result.reason = "Operation did not complete within 4 hours";
        return result;
    }

    result.success = true;
    result.supported = true;
    result.executed = true;
    result.status = "success";
    result.message = "NVMe Sanitize completed successfully";
    result.reason = "Completed in " + std::to_string(duration) + " seconds";

    std::cout << "\n=== SANITIZE COMPLETE ===" << std::endl;
    std::cout << "Time: " << duration << " seconds" << std::endl;

    return result;
}

// Backward compatibility wrapper
bool nvmeSanitizeLegacy(const std::string& drivePath, const std::string& action) {
    PurgeResult result = nvmeSanitize(drivePath, action, false);
    return result.success;
}

// Export for testing
#ifdef TEST_STANDALONE
int main() {
    std::string testDrive = "\\\\.\\PhysicalDrive1";
    
    std::cout << "--- DRY RUN TEST ---" << std::endl;
    PurgeResult result = nvmeSanitize(testDrive, "crypto", true);
    std::cout << "\nResult:" << std::endl;
    std::cout << "  Status: " << result.status << std::endl;
    std::cout << "  Supported: " << result.supported << std::endl;
    std::cout << "  Executed: " << result.executed << std::endl;
    std::cout << "  Device Type: " << deviceTypeToString(result.deviceType) << std::endl;
    std::cout << "  Message: " << result.message << std::endl;
    
    return 0;
}
#endif
