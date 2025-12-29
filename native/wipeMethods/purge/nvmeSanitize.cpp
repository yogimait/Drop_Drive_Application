#include <windows.h>
#include <winioctl.h>
#include <nvme.h>
#include <string>
#include <iostream>
#include <chrono>
#include <thread>

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

// NVMe Admin Command structure
struct NVMeSanitizeCommand {
    uint8_t opcode;           // 0x84 for Sanitize
    uint8_t flags;
    uint16_t command_id;
    uint32_t nsid;            // Namespace ID (0xFFFFFFFF for all)
    uint64_t reserved1;
    uint64_t metadata_ptr;
    uint64_t data_ptr1;
    uint64_t data_ptr2;
    uint32_t cdw10;           // Sanitize Action
    uint32_t cdw11;           // Overwrite pattern (if applicable)
    uint32_t cdw12_15[4];
};

struct NVMeSanitizeStatus {
    uint16_t sanitize_progress;     // 0-65535 (0xFFFF = complete)
    uint16_t sanitize_status;       // Status field
    uint32_t global_data_erased;    // Global data erased indicator
    uint32_t reserved[6];
};

#pragma pack(pop)

// Check if device is NVMe
static bool isNVMeDevice(const std::string& drivePath) {
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
        return false;
    }

    STORAGE_PROPERTY_QUERY query;
    ZeroMemory(&query, sizeof(query));
    query.PropertyId = StorageAdapterProperty;
    query.QueryType = PropertyStandardQuery;

    STORAGE_ADAPTER_DESCRIPTOR descriptor;
    DWORD bytesReturned = 0;

    bool isNVMe = false;
    if (DeviceIoControl(hDevice,
                        IOCTL_STORAGE_QUERY_PROPERTY,
                        &query,
                        sizeof(query),
                        &descriptor,
                        sizeof(descriptor),
                        &bytesReturned,
                        NULL)) {
        // Check bus type for NVMe
        isNVMe = (descriptor.BusType == BusTypeNvme);
    }

    CloseHandle(hDevice);
    return isNVMe;
}

// Get sanitize status
static bool getSanitizeStatus(HANDLE hDevice, NVMeSanitizeStatus& status) {
    STORAGE_PROTOCOL_COMMAND cmd;
    ZeroMemory(&cmd, sizeof(cmd));
    
    cmd.Version = STORAGE_PROTOCOL_STRUCTURE_VERSION;
    cmd.Length = sizeof(STORAGE_PROTOCOL_COMMAND);
    cmd.ProtocolType = ProtocolTypeNvme;
    cmd.Flags = STORAGE_PROTOCOL_COMMAND_FLAG_ADAPTER_REQUEST;
    cmd.CommandLength = STORAGE_PROTOCOL_COMMAND_LENGTH_NVME;
    cmd.ErrorInfoLength = sizeof(NVME_ERROR_INFO_LOG);
    cmd.DataToDeviceTransferLength = 0;
    cmd.DataFromDeviceTransferLength = sizeof(NVMeSanitizeStatus);
    cmd.TimeOutValue = 10;
    cmd.ErrorInfoOffset = sizeof(STORAGE_PROTOCOL_COMMAND);
    cmd.DataFromDeviceBufferOffset = sizeof(STORAGE_PROTOCOL_COMMAND) + sizeof(NVME_ERROR_INFO_LOG);
    cmd.CommandSpecific = STORAGE_PROTOCOL_SPECIFIC_NVME_ADMIN_COMMAND;

    struct  {
        STORAGE_PROTOCOL_COMMAND Command;
        NVME_ERROR_INFO_LOG ErrorInfo;
        NVMeSanitizeStatus Data;
    } cmdBuffer;

    ZeroMemory(&cmdBuffer, sizeof(cmdBuffer));
    memcpy(&cmdBuffer.Command, &cmd, sizeof(cmd));

    // Set up Get Log Page command for Sanitize Status
    NVME_COMMAND* nvmeCmd = (NVME_COMMAND*)&cmdBuffer.Command.Command;
    nvmeCmd->CDW0.OPC = NVME_ADMIN_CMD_GET_LOG_PAGE;
    nvmeCmd->NSID = 0xFFFFFFFF;
    nvmeCmd->u.GETLOGPAGE.CDW10.LID = NVME_LOG_PAGE_SANITIZE_STATUS;
    nvmeCmd->u.GETLOGPAGE.CDW10.NUMD = (sizeof(NVMeSanitizeStatus) / 4) - 1;

    DWORD bytesReturned = 0;
    if (DeviceIoControl(hDevice,
                        IOCTL_STORAGE_PROTOCOL_COMMAND,
                        &cmdBuffer,
                        sizeof(cmdBuffer),
                        &cmdBuffer,
                        sizeof(cmdBuffer),
                        &bytesReturned,
                        NULL)) {
        memcpy(&status, &cmdBuffer.Data, sizeof(status));
        return true;
    }

    return false;
}

// Execute NVMe Sanitize
bool nvmeSanitize(const std::string& drivePath, const std::string& action = "crypto") {
    std::cout << "=== NVMe Sanitize ===" << std::endl;
    std::cout << "Drive: " << drivePath << std::endl;
    std::cout << "Action: " << action << std::endl;

    // Verify NVMe device
    if (!isNVMeDevice(drivePath)) {
        std::cerr << "ERROR: Drive is not an NVMe device" << std::endl;
        return false;
    }

    // Determine sanitize action
    uint8_t sanitizeAction;
    if (action == "crypto") {
        sanitizeAction = NVME_SANITIZE_ACTION_CRYPTO_ERASE;
        std::cout << "Mode: Cryptographic Erase (delete encryption keys)" << std::endl;
    } else if (action == "block") {
        sanitizeAction = NVME_SANITIZE_ACTION_BLOCK_ERASE;
        std::cout << "Mode: Block Erase (hardware block erasure)" << std::endl;
    } else if (action == "overwrite") {
        sanitizeAction = NVME_SANITIZE_ACTION_OVERWRITE;
        std::cout << "Mode: Overwrite (firmware-controlled overwrite)" << std::endl;
    } else {
        std::cerr << "ERROR: Invalid action. Use 'crypto', 'block', or 'overwrite'" << std::endl;
        return false;
    }

    // Open device
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
        std::cerr << "Error opening drive: " << GetLastError() << std::endl;
        return false;
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
    cmd.DataToDeviceTransferLength = 0;
    cmd.DataFromDeviceTransferLength = 0;
    cmd.TimeOutValue = 60; // Sanitize can take a very long time
    cmd.CommandSpecific = STORAGE_PROTOCOL_SPECIFIC_NVME_ADMIN_COMMAND;

    struct {
        STORAGE_PROTOCOL_COMMAND Command;
        NVME_ERROR_INFO_LOG ErrorInfo;
    } cmdBuffer;

    ZeroMemory(&cmdBuffer, sizeof(cmdBuffer));
    memcpy(&cmdBuffer.Command, &cmd, sizeof(cmd));

    // Set up Sanitize command
    NVME_COMMAND* nvmeCmd = (NVME_COMMAND*)&cmdBuffer.Command.Command;
    nvmeCmd->CDW0.OPC = NVME_ADMIN_CMD_SANITIZE;
    nvmeCmd->NSID = 0xFFFFFFFF;  // All namespaces
    
    // CDW10: Sanitize Action and options
    nvmeCmd->u.GENERAL.CDW10 = (sanitizeAction & 0x07);  // Bits 0-2: Sanitize Action
    // Bit 3: AUSE (Allow Unrestricted Sanitize Exit) - set to 0
    // Bit 4: OWPASS (Overwrite Pass Count) - not used for crypto erase
    // Bit 8: OIPBP (Overwrite Invert Pattern Between Passes) - not used
    // Bit 9: NDAS (No Deallocate After Sanitize) - set to 0

    std::cout << "Starting NVMe Sanitize operation..." << std::endl;
    std::cout << "WARNING: This operation cannot be stopped and may take a long time!" << std::endl;

    DWORD bytesReturned = 0;
    auto startTime = std::chrono::high_resolution_clock::now();

    if (!DeviceIoControl(hDevice,
                         IOCTL_STORAGE_PROTOCOL_COMMAND,
                         &cmdBuffer,
                         sizeof(cmdBuffer),
                         &cmdBuffer,
                         sizeof(cmdBuffer),
                         &bytesReturned,
                         NULL)) {
        DWORD error = GetLastError();
        std::cerr << "Sanitize command failed: " << error << std::endl;
        CloseHandle(hDevice);
        return false;
    }

    std::cout << "Sanitize command issued successfully." << std::endl;
    std::cout << "Polling for completion..." << std::endl;

    // Poll for completion
    bool completed = false;
    int pollCount = 0;
    while (!completed) {
        std::this_thread::sleep_for(std::chrono::seconds(5));
        pollCount++;

        NVMeSanitizeStatus status;
        if (getSanitizeStatus(hDevice, status)) {
            uint16_t progress = status.sanitize_progress;
            uint16_t statusField = status.sanitize_status;

            // Check if sanitize is complete
            if ((statusField & 0x07) == 0) {  // Bits 0-2: No sanitize operation in progress
                std::cout << "Sanitize complete!" << std::endl;
                completed = true;
            } else {
                // Calculate progress percentage
                double progressPct = (progress / 65535.0) * 100.0;
                std::cout << "Progress: " << (int)progressPct << "% (Poll #" << pollCount << ")" << std::endl;
            }
        } else {
            std::cout << "Warning: Could not read sanitize status (Poll #" << pollCount << ")" << std::endl;
        }

        // Timeout after 4 hours
        if (pollCount > 2880) {  // 5 seconds * 2880 = 4 hours
            std::cerr << "ERROR: Sanitize operation timed out after 4 hours" << std::endl;
            CloseHandle(hDevice);
            return false;
        }
    }

    auto endTime = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::seconds>(endTime - startTime).count();

    std::cout << "\\nNVMe Sanitize completed successfully!" << std::endl;
    std::cout << "Time taken: " << duration << " seconds (" << (duration / 60) << " minutes)" << std::endl;

    CloseHandle(hDevice);
    return true;
}

// Export for testing
#ifdef TEST_STANDALONE
int main() {
    std::string testDrive = "\\\\.\\PhysicalDrive1";  // Change this!
    
    std::cout << "WARNING: This will ERASE ALL DATA on " << testDrive << "!" << std::endl;
    std::cout << "Type 'YES ERASE' to continue: ";
    
    std::string confirmation;
    std::getline(std::cin, confirmation);
    
    if (confirmation != "YES ERASE") {
        std::cout << "Cancelled." << std::endl;
        return 0;
    }
    
    bool success = nvmeSanitize(testDrive, "crypto");
    return success ? 0 : 1;
}
#endif
