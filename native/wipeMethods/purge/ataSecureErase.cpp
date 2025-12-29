#include <windows.h>
#include <winioctl.h>
#include <ntddscsi.h>
#include <string>
#include <iostream>
#include <chrono>
#include <thread>

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

// Get ATA security information
ATASecurityInfo getATASecurityInfo(const std::string& drivePath) {
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

    // Prepare ATA IDENTIFY DEVICE command
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
        
        std::cout << "Security Status:" << std::endl;
        std::cout << "  Supported: " << info.supported << std::endl;
        std::cout << "  Enabled: " << info.enabled << std::endl;
        std::cout << "  Locked: " << info.locked << std::endl;
        std::cout << "  Frozen: " << info.frozen << std::endl;
        std::cout << "  Enhanced Erase: " << info.enhancedEraseSupported << std::endl;
    } else {
        std::cerr << "IDENTIFY DEVICE failed: " << GetLastError() << std::endl;
    }

    CloseHandle(hDevice);
    return info;
}

// Execute ATA Secure Erase
bool ataSecureErase(const std::string& drivePath, bool useEnhanced = false) {
    std::cout << "=== ATA Secure Erase ===" << std::endl;
    std::cout << "Drive: " << drivePath << std::endl;
    std::cout << "Mode: " << (useEnhanced ? "Enhanced" : "Normal") << std::endl;

    // Step 0: Check security status
    ATASecurityInfo secInfo = getATASecurityInfo(drivePath);
    
    if (!secInfo.supported) {
        std::cerr << "ERROR: Drive does not support ATA Secure Erase" << std::endl;
        return false;
    }

    if (secInfo.frozen) {
        std::cerr << "ERROR: Drive is security frozen. Cannot execute Secure Erase." << std::endl;
        std::cerr << "Solution: Reboot system or use a power cycle to unfreeze." << std::endl;
        return false;
    }

    if (secInfo.locked) {
        std::cerr << "ERROR: Drive is locked. Cannot execute Secure Erase." << std::endl;
        return false;
    }

    if (useEnhanced && !secInfo.enhancedEraseSupported) {
        std::cerr << "WARNING: Enhanced erase not supported. Using normal erase." << std::endl;
        useEnhanced = false;
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

    // Password buffer (typically set to all zeros for initial secure erase)
    BYTE passwordBuffer[512] = {0};
    // Set master password indicator (bit 0 = user password)
    passwordBuffer[0] = 0;  // User level

    struct {
        ATA_PASS_THROUGH_EX apt;
        BYTE buffer[512];
    } commandData;

    DWORD bytesReturned = 0;

    // Step 1: SECURITY SET PASSWORD (required before erase)
    std::cout << "Step 1: Setting security password..." << std::endl;
    ZeroMemory(&commandData, sizeof(commandData));
    memcpy(commandData.buffer, passwordBuffer, 512);
    
    commandData.apt.Length = sizeof(ATA_PASS_THROUGH_EX);
    commandData.apt.AtaFlags = ATA_FLAGS_DATA_OUT;
    commandData.apt.DataTransferLength = 512;
    commandData.apt.TimeOutValue = 15;
    commandData.apt.DataBufferOffset = sizeof(ATA_PASS_THROUGH_EX);
    commandData.apt.CurrentTaskFile[6] = ATA_CMD_SECURITY_SET_PASSWORD;

    if (!DeviceIoControl(hDevice,
                         IOCTL_ATA_PASS_THROUGH,
                         &commandData,
                         sizeof(commandData),
                         &commandData,
                         sizeof(commandData),
                         &bytesReturned,
                         NULL)) {
        std::cerr << "Set Password failed: " << GetLastError() << std::endl;
        CloseHandle(hDevice);
        return false;
    }
    std::cout << "Password set successfully." << std::endl;

    // Step 2: SECURITY ERASE PREPARE
    std::cout << "Step 2: Erase prepare..." << std::endl;
    ZeroMemory(&commandData, sizeof(commandData));
    
    commandData.apt.Length = sizeof(ATA_PASS_THROUGH_EX);
    commandData.apt.AtaFlags = ATA_FLAGS_DATA_OUT;
    commandData.apt.DataTransferLength = 0;
    commandData.apt.TimeOutValue = 10;
    commandData.apt.DataBufferOffset = 0;
    commandData.apt.CurrentTaskFile[6] = ATA_CMD_SECURITY_ERASE_PREPARE;

    if (!DeviceIoControl(hDevice,
                         IOCTL_ATA_PASS_THROUGH,
                         &commandData,
                         sizeof(ATA_PASS_THROUGH_EX),
                         &commandData,
                         sizeof(ATA_PASS_THROUGH_EX),
                         &bytesReturned,
                         NULL)) {
        std::cerr << "Erase Prepare failed: " << GetLastError() << std::endl;
        CloseHandle(hDevice);
        return false;
    }
    std::cout << "Erase prepare complete." << std::endl;

    // Step 3: SECURITY ERASE UNIT
    std::cout << "Step 3: Executing secure erase..." << std::endl;
    std::cout << "WARNING: This may take a long time (10 minutes to several hours)." << std::endl;
    std::cout << "DO NOT interrupt or power off the drive!" << std::endl;

    ZeroMemory(&commandData, sizeof(commandData));
    memcpy(commandData.buffer, passwordBuffer, 512);
    
    // Set enhanced erase bit if requested (bit 1)
    if (useEnhanced) {
        commandData.buffer[0] = 0x02;  // Enhanced erase
    }
    
    commandData.apt.Length = sizeof(ATA_PASS_THROUGH_EX);
    commandData.apt.AtaFlags = ATA_FLAGS_DATA_OUT;
    commandData.apt.DataTransferLength = 512;
    // Very long timeout - secure erase can take hours
    commandData.apt.TimeOutValue = 60 * 60 * 4; // 4 hours max
    commandData.apt.DataBufferOffset = sizeof(ATA_PASS_THROUGH_EX);
    commandData.apt.CurrentTaskFile[6] = ATA_CMD_SECURITY_ERASE_UNIT;

    auto startTime = std::chrono::high_resolution_clock::now();

    if (!DeviceIoControl(hDevice,
                         IOCTL_ATA_PASS_THROUGH,
                         &commandData,
                         sizeof(commandData),
                         &commandData,
                         sizeof(commandData),
                         &bytesReturned,
                         NULL)) {
        DWORD error = GetLastError();
        std::cerr << "Erase Unit failed: " << error << std::endl;
        
        if (error == ERROR_IO_DEVICE || error == ERROR_GEN_FAILURE) {
            std::cerr << "This may be due to timeout. Check drive status manually." << std::endl;
        }
        
        CloseHandle(hDevice);
        return false;
    }

    auto endTime = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::seconds>(endTime - startTime).count();

    std::cout << "\\nSecure erase completed successfully!" << std::endl;
    std::cout << "Time taken: " << duration << " seconds (" << (duration / 60) << " minutes)" << std::endl;

    CloseHandle(hDevice);
    return true;
}

// Export for testing
#ifdef TEST_STANDALONE
int main() {
    // WARNING: DO NOT run on production drives!
    std::string testDrive = "\\\\.\\PhysicalDrive1";  // Change this!
    
    std::cout << "WARNING: This will ERASE ALL DATA on " << testDrive << "!" << std::endl;
    std::cout << "Type 'YES ERASE' to continue: ";
    
    std::string confirmation;
    std::getline(std::cin, confirmation);
    
    if (confirmation != "YES ERASE") {
        std::cout << "Cancelled." << std::endl;
        return 0;
    }
    
    bool success = ataSecureErase(testDrive, false);
    return success ? 0 : 1;
}
#endif
