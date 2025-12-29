#include <windows.h>
#include <winioctl.h>
#include <ntddscsi.h>
#include <nvme.h>
#include <string>
#include <iostream>

// Crypto erase strategies
enum CryptoEraseMethod {
    CRYPTO_NVME_FORMAT,
    CRYPTO_TCG_OPAL,
    CRYPTO_ATA_SECURE_ERASE,
    CRYPTO_NOT_SUPPORTED
};

// Forward declarations
bool isNVMeDevice(const std::string& drivePath);
bool hasHardwareEncryption(const std::string& drivePath);
CryptoEraseMethod detectCryptoEraseMethod(const std::string& drivePath);
bool nvmeFormatCryptoErase(const std::string& drivePath);
bool tcgOpalRevert(const std::string& drivePath);
extern bool ataSecureErase(const std::string& drivePath, bool useEnhanced);

// Check if device has hardware encryption
static bool hasHardwareEncryption(const std::string& drivePath) {
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

    // Query device properties for encryption support
    STORAGE_PROPERTY_QUERY query;
    ZeroMemory(&query, sizeof(query));
    query.PropertyId = StorageDeviceProperty;
    query.QueryType = PropertyStandardQuery;

    BYTE buffer[4096];
    DWORD bytesReturned = 0;

    bool hasEncryption = false;
    if (DeviceIoControl(hDevice,
                        IOCTL_STORAGE_QUERY_PROPERTY,
                        &query,
                        sizeof(query),
                        buffer,
                        sizeof(buffer),
                        &bytesReturned,
                        NULL)) {
        STORAGE_DEVICE_DESCRIPTOR* descriptor = (STORAGE_DEVICE_DESCRIPTOR*)buffer;
        
        // Check for encryption keywords in product/vendor strings
        if (descriptor->ProductIdOffset > 0) {
            char* productId = (char*)(buffer + descriptor->ProductIdOffset);
            std::string product(productId);
            
            // Look for encryption indicators
            if (product.find("SED") != std::string::npos ||
                product.find("Opal") != std::string::npos ||
                product.find("TCG") != std::string::npos ||
                product.find("Encrypted") != std::string::npos) {
                hasEncryption = true;
            }
        }
    }

    CloseHandle(hDevice);
    return hasEncryption;
}

// Detect the appropriate crypto erase method
CryptoEraseMethod detectCryptoEraseMethod(const std::string& drivePath) {
    // Check for NVMe device first
    if (isNVMeDevice(drivePath)) {
        std::cout << "Detected NVMe device - using NVMe Format with Crypto Erase" << std::endl;
        return CRYPTO_NVME_FORMAT;
    }

    // Check for hardware encryption (TCG Opal)
    if (hasHardwareEncryption(drivePath)) {
        std::cout << "Detected hardware encryption - using TCG Opal Revert" << std::endl;
        return CRYPTO_TCG_OPAL;
    }

    // Fallback to ATA Secure Erase for regular drives
    std::cout << "No hardware encryption detected - using ATA Secure Erase" << std::endl;
    return CRYPTO_ATA_SECURE_ERASE;
}

// NVMe Format with Cryptographic Erase
bool nvmeFormatCryptoErase(const std::string& drivePath) {
    std::cout << "Executing NVMe Format with Cryptographic Erase..." << std::endl;

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

    // Prepare NVMe Format command
    STORAGE_PROTOCOL_COMMAND cmd;
    ZeroMemory(&cmd, sizeof(cmd));
    
    cmd.Version = STORAGE_PROTOCOL_STRUCTURE_VERSION;
    cmd.Length = sizeof(STORAGE_PROTOCOL_COMMAND);
    cmd.ProtocolType = ProtocolTypeNvme;
    cmd.Flags = STORAGE_PROTOCOL_COMMAND_FLAG_ADAPTER_REQUEST;
    cmd.CommandLength = STORAGE_PROTOCOL_COMMAND_LENGTH_NVME;
    cmd.ErrorInfoLength = sizeof(NVME_ERROR_INFO_LOG);
    cmd.TimeOutValue = 600; // 10 minutes
    cmd.CommandSpecific = STORAGE_PROTOCOL_SPECIFIC_NVME_ADMIN_COMMAND;

    struct {
        STORAGE_PROTOCOL_COMMAND Command;
        NVME_ERROR_INFO_LOG ErrorInfo;
    } cmdBuffer;

    ZeroMemory(&cmdBuffer, sizeof(cmdBuffer));
    memcpy(&cmdBuffer.Command, &cmd, sizeof(cmd));

    // Set up Format NVM command
    NVME_COMMAND* nvmeCmd = (NVME_COMMAND*)&cmdBuffer.Command.Command;
    nvmeCmd->CDW0.OPC = 0x80;  // Format NVM Admin Command
    nvmeCmd->NSID = 0xFFFFFFFF;  // All namespaces
    
    // CDW10: Format parameters
    // Bits 0-3: LBAF (LBA Format) = 0 (use current)
    // Bits 4-6: MSET (Metadata Settings) = 0
    // Bits 7-8: PI (Protection Information) = 0
    // Bits 9-10: PIL (Protection Information Location) = 0
    // Bits 11-13: SES (Secure Erase Settings) = 2 (Cryptographic  Erase)
    nvmeCmd->u.GENERAL.CDW10 = 0x00001000;  // SES = 0b010 (bit 12 set)

    DWORD bytesReturned = 0;
    if (!DeviceIoControl(hDevice,
                         IOCTL_STORAGE_PROTOCOL_COMMAND,
                         &cmdBuffer,
                         sizeof(cmdBuffer),
                         &cmdBuffer,
                         sizeof(cmdBuffer),
                         &bytesReturned,
                         NULL)) {
        std::cerr << "NVMe Format command failed: " << GetLastError() << std::endl;
        CloseHandle(hDevice);
        return false;
    }

    std::cout << "NVMe Cryptographic Erase completed successfully!" << std::endl;
    CloseHandle(hDevice);
    return true;
}

// TCG Opal Revert (erase encryption keys)
bool tcgOpalRevert(const std::string& drivePath) {
    std::cout << "Executing TCG Opal Admin Revert..." << std::endl;
    std::cout << "WARNING: This is a simplified implementation." << std::endl;
    std::cout << "For production use, consider using dedicated TCG Opal tools like sedutil." << std::endl;

    // This is a placeholder - Full TCG Opal implementation is very complex
    // It requires:
    // 1. Opening a session
    // 2. Authenticating with MSID
    // 3. Sending Revert command
    // 4. Closing session
    
    // For now, we'll use a simpler approach with SCSI pass-through
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

    // TCG Opal requires complex command sequences
    // Here we just demonstrate the structure
    std::cout << "Note: Full TCG Opal Revert requires specialized libraries." << std::endl;
    std::cout << "Falling back to ATA Secure Erase for encrypted drives." << std::endl;

    CloseHandle(hDevice);
    
    // Fall back to ATA Secure Erase
    return ataSecureErase(drivePath, false);
}

// Main crypto erase function
bool cryptoErase(const std::string& drivePath) {
    std::cout << "=== Cryptographic Erase ===" << std::endl;
    std::cout << "Drive: " << drivePath << std::endl;

    // Detect the appropriate method
    CryptoEraseMethod method = detectCryptoEraseMethod(drivePath);

    switch (method) {
        case CRYPTO_NVME_FORMAT:
            return nvmeFormatCryptoErase(drivePath);
        
        case CRYPTO_TCG_OPAL:
            return tcgOpalRevert(drivePath);
        
        case CRYPTO_ATA_SECURE_ERASE:
            return ataSecureErase(drivePath, false);
        
        case CRYPTO_NOT_SUPPORTED:
        default:
            std::cerr << "ERROR: Crypto erase not supported for this device" << std::endl;
            return false;
    }
}

// Helper function - Check if device is NVMe (imported from nvmeSanitize.cpp logic)
static bool isNVMeDevice(const std::string& drivePath) {
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
        isNVMe = (descriptor.BusType == BusTypeNvme);
    }

    CloseHandle(hDevice);
    return isNVMe;
}

// Export for testing
#ifdef TEST_STANDALONE
int main() {
    std::string testDrive = "\\\\.\\PhysicalDrive1";
    
    std::cout << "WARNING: This will ERASE ALL DATA on " << testDrive << "!" << std::endl;
    std::cout << "Type 'YES ERASE' to continue: ";
    
    std::string confirmation;
    std::getline(std::cin, confirmation);
    
    if (confirmation != "YES ERASE") {
        std::cout << "Cancelled." << std::endl;
        return 0;
    }
    
    bool success = cryptoErase(testDrive);
    return success ? 0 : 1;
}
#endif
