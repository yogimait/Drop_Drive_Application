#include <windows.h>
#include <winioctl.h>
#include <ntddscsi.h>
#include <nvme.h>
#include <string>
#include <iostream>
#include "purgeCommon.h"

// Forward declarations for external purge functions
extern PurgeResult ataSecureErase(const std::string& drivePath, bool useEnhanced, bool dryRun);
extern PurgeResult nvmeSanitize(const std::string& drivePath, const std::string& action, bool dryRun);

// Crypto erase strategies
enum CryptoEraseStrategy {
    STRATEGY_NVME_FORMAT,
    STRATEGY_NVME_SANITIZE,
    STRATEGY_TCG_OPAL,
    STRATEGY_ATA_SECURE_ERASE,
    STRATEGY_NOT_SUPPORTED
};

// Detect device type
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

// Check if device has hardware encryption (non-destructive)
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

    bool hasEncryption = false;

    STORAGE_PROPERTY_QUERY query;
    ZeroMemory(&query, sizeof(query));
    query.PropertyId = StorageDeviceProperty;
    query.QueryType = PropertyStandardQuery;

    BYTE buffer[4096];
    DWORD bytesReturned = 0;

    if (DeviceIoControl(hDevice,
                        IOCTL_STORAGE_QUERY_PROPERTY,
                        &query,
                        sizeof(query),
                        buffer,
                        sizeof(buffer),
                        &bytesReturned,
                        NULL)) {
        STORAGE_DEVICE_DESCRIPTOR* descriptor = (STORAGE_DEVICE_DESCRIPTOR*)buffer;
        
        if (descriptor->ProductIdOffset > 0) {
            char* productId = (char*)(buffer + descriptor->ProductIdOffset);
            std::string product(productId);
            
            // Check for encryption indicators
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

// Detect the best crypto erase strategy
static CryptoEraseStrategy detectStrategy(DeviceType deviceType, bool hasEncryption) {
    switch (deviceType) {
        case DeviceType::NVME:
            return STRATEGY_NVME_SANITIZE;  // NVMe crypto sanitize
        
        case DeviceType::SATA_SSD:
        case DeviceType::SATA_HDD:
            if (hasEncryption) {
                return STRATEGY_TCG_OPAL;   // Use TCG Opal for SED drives
            }
            return STRATEGY_ATA_SECURE_ERASE;  // Fallback to ATA
        
        case DeviceType::USB:
            return STRATEGY_NOT_SUPPORTED;  // USB doesn't support hardware purge
        
        default:
            return STRATEGY_NOT_SUPPORTED;
    }
}

// Main Crypto Erase function with dryRun support
PurgeResult cryptoErase(const std::string& drivePath, bool dryRun) {
    PurgeResult result;
    result.devicePath = drivePath;
    result.method = PurgeMethod::CRYPTO_ERASE;
    
    std::cout << "=== Cryptographic Erase ===" << std::endl;
    std::cout << "Drive: " << drivePath << std::endl;
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
        result.message = "Crypto Erase not supported for " + deviceTypeToString(result.deviceType) + " devices";
        result.reason = getUnsupportedReason(result.deviceType);
        std::cerr << "ERROR: " << result.message << std::endl;
        std::cerr << "Reason: " << result.reason << std::endl;
        return result;
    }

    // Step 3: Check for hardware encryption (non-destructive)
    bool hasEncryption = hasHardwareEncryption(drivePath);
    std::cout << "Hardware Encryption Detected: " << (hasEncryption ? "Yes" : "No") << std::endl;

    // Step 4: Determine best strategy
    CryptoEraseStrategy strategy = detectStrategy(result.deviceType, hasEncryption);
    
    std::string strategyName;
    switch (strategy) {
        case STRATEGY_NVME_SANITIZE:
            strategyName = "NVMe Sanitize (Crypto Erase)";
            result.method = PurgeMethod::NVME_SANITIZE_CRYPTO;
            break;
        case STRATEGY_NVME_FORMAT:
            strategyName = "NVMe Format (Crypto Erase)";
            result.method = PurgeMethod::NVME_FORMAT_CRYPTO;
            break;
        case STRATEGY_TCG_OPAL:
            strategyName = "TCG Opal Revert";
            result.method = PurgeMethod::TCG_OPAL_REVERT;
            break;
        case STRATEGY_ATA_SECURE_ERASE:
            strategyName = "ATA Secure Erase";
            result.method = PurgeMethod::ATA_SECURE_ERASE;
            break;
        default:
            result.success = false;
            result.supported = false;
            result.executed = false;
            result.status = "unsupported";
            result.message = "No suitable crypto erase method found";
            result.reason = "Device does not support any hardware crypto erase methods";
            return result;
    }
    
    std::cout << "Selected Strategy: " << strategyName << std::endl;

    // DRY RUN: Return capability information without executing
    if (dryRun) {
        result.success = true;
        result.supported = true;
        result.executed = false;
        result.status = "dry_run";
        result.message = "Crypto Erase is SUPPORTED using " + strategyName + " (dry run)";
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

    // Execute based on strategy
    switch (strategy) {
        case STRATEGY_NVME_SANITIZE:
            // Delegate to NVMe sanitize
            return nvmeSanitize(drivePath, "crypto", false);
        
        case STRATEGY_ATA_SECURE_ERASE:
            // Delegate to ATA secure erase
            return ataSecureErase(drivePath, false, false);
        
        case STRATEGY_TCG_OPAL:
            // TCG Opal not fully implemented - fall back to ATA
            std::cout << "Note: TCG Opal not fully implemented. Using ATA Secure Erase." << std::endl;
            return ataSecureErase(drivePath, false, false);
        
        default:
            result.success = false;
            result.supported = false;
            result.executed = false;
            result.status = "error";
            result.message = "Internal error: Invalid strategy";
            result.reason = "Strategy selection logic error";
            return result;
    }
}

// Backward compatibility wrapper
bool cryptoEraseLegacy(const std::string& drivePath) {
    PurgeResult result = cryptoErase(drivePath, false);
    return result.success;
}

// Export for testing
#ifdef TEST_STANDALONE
int main() {
    std::string testDrive = "\\\\.\\PhysicalDrive1";
    
    std::cout << "--- DRY RUN TEST ---" << std::endl;
    PurgeResult result = cryptoErase(testDrive, true);
    std::cout << "\nResult:" << std::endl;
    std::cout << "  Status: " << result.status << std::endl;
    std::cout << "  Supported: " << result.supported << std::endl;
    std::cout << "  Executed: " << result.executed << std::endl;
    std::cout << "  Device Type: " << deviceTypeToString(result.deviceType) << std::endl;
    std::cout << "  Method: " << purgeMethodToString(result.method) << std::endl;
    std::cout << "  Message: " << result.message << std::endl;
    
    return 0;
}
#endif
