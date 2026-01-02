#pragma once
#include <string>
#include <cstdint>

// Device types for purge operations
enum class DeviceType {
    USB,
    SATA_HDD,
    SATA_SSD,
    NVME,
    SCSI,
    UNKNOWN
};

// Purge methods
enum class PurgeMethod {
    ATA_SECURE_ERASE,
    ATA_SECURE_ERASE_ENHANCED,
    NVME_SANITIZE_CRYPTO,
    NVME_SANITIZE_BLOCK,
    NVME_SANITIZE_OVERWRITE,
    NVME_FORMAT_CRYPTO,
    CRYPTO_ERASE,
    TCG_OPAL_REVERT,
    NOT_APPLICABLE
};

// Standardized result structure for all purge operations
struct PurgeResult {
    bool success;           // Overall operation success
    bool supported;         // Is the purge method supported for this device?
    bool executed;          // Was the actual destructive operation performed?
    DeviceType deviceType;  // Detected device type
    PurgeMethod method;     // Purge method used/attempted
    std::string status;     // Status string: "success", "dry_run", "unsupported", "error"
    std::string message;    // Human-readable message
    std::string reason;     // Detailed reason (for failures or dry-run info)
    std::string devicePath; // The device path
    uint32_t errorCode;     // Windows error code if applicable
    
    // Constructor for easy initialization
    PurgeResult() : 
        success(false), 
        supported(false), 
        executed(false), 
        deviceType(DeviceType::UNKNOWN),
        method(PurgeMethod::NOT_APPLICABLE),
        status("unknown"),
        message(""),
        reason(""),
        devicePath(""),
        errorCode(0) {}
};

// Helper functions for device type detection
inline std::string deviceTypeToString(DeviceType type) {
    switch (type) {
        case DeviceType::USB:      return "USB";
        case DeviceType::SATA_HDD: return "SATA_HDD";
        case DeviceType::SATA_SSD: return "SATA_SSD";
        case DeviceType::NVME:     return "NVMe";
        case DeviceType::SCSI:     return "SCSI";
        default:                   return "Unknown";
    }
}

inline std::string purgeMethodToString(PurgeMethod method) {
    switch (method) {
        case PurgeMethod::ATA_SECURE_ERASE:          return "ATA_SECURE_ERASE";
        case PurgeMethod::ATA_SECURE_ERASE_ENHANCED: return "ATA_SECURE_ERASE_ENHANCED";
        case PurgeMethod::NVME_SANITIZE_CRYPTO:      return "NVME_SANITIZE_CRYPTO";
        case PurgeMethod::NVME_SANITIZE_BLOCK:       return "NVME_SANITIZE_BLOCK";
        case PurgeMethod::NVME_SANITIZE_OVERWRITE:   return "NVME_SANITIZE_OVERWRITE";
        case PurgeMethod::NVME_FORMAT_CRYPTO:        return "NVME_FORMAT_CRYPTO";
        case PurgeMethod::CRYPTO_ERASE:              return "CRYPTO_ERASE";
        case PurgeMethod::TCG_OPAL_REVERT:           return "TCG_OPAL_REVERT";
        default:                                      return "NOT_APPLICABLE";
    }
}

// USB devices do NOT support hardware purge operations
// They can only be wiped via software overwrite (Clear level)
inline bool isPurgeSupported(DeviceType type) {
    switch (type) {
        case DeviceType::USB:
            return false;  // USB devices don't support ATA/NVMe purge commands
        case DeviceType::SATA_HDD:
        case DeviceType::SATA_SSD:
        case DeviceType::NVME:
            return true;
        default:
            return false;
    }
}

inline std::string getUnsupportedReason(DeviceType type) {
    switch (type) {
        case DeviceType::USB:
            return "USB devices do not support ATA Secure Erase or NVMe Sanitize. "
                   "Use software overwrite (Clear) methods instead.";
        case DeviceType::UNKNOWN:
            return "Device type could not be determined. Cannot perform hardware purge.";
        default:
            return "This device type does not support hardware purge operations.";
    }
}
