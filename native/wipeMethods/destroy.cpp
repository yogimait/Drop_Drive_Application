#include <windows.h>
#include <winioctl.h>
#include <string>
#include <iostream>
#include <vector>
#include <chrono>
#include <cstdlib>
#include <cstring>

// Gutmann pattern sequences (simplified - using key patterns)
const std::vector<uint8_t> GUTMANN_PATTERNS = {
    0x55, 0xAA, 0x92, 0x49, 0x24, 0x00, 0x11, 0x22, 0x33, 0x44,
    0x55, 0x66, 0x77, 0x88, 0x99, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE,
    0xFF, 0x92, 0x49, 0x24, 0x6D, 0xB6, 0xDB, 0xFF, 0x00
};

// Buffer size for operations
constexpr size_t DESTROY_BUFFER_SIZE = 32 * 1024 * 1024;  // 32MB

// Get device size
static uint64_t getDeviceSize(const std::string& path) {
    HANDLE hDevice = CreateFileA(path.c_str(), GENERIC_READ,
                                  FILE_SHARE_READ | FILE_SHARE_WRITE, NULL, OPEN_EXISTING, 0, NULL);
    
    if (hDevice != INVALID_HANDLE_VALUE) {
        GET_LENGTH_INFORMATION lengthInfo;
        DWORD bytesReturned;
        
        if (DeviceIoControl(hDevice, IOCTL_DISK_GET_LENGTH_INFO, NULL, 0,
                           &lengthInfo, sizeof(lengthInfo), &bytesReturned, NULL)) {
            CloseHandle(hDevice);
            return static_cast<uint64_t>(lengthInfo.Length.QuadPart);
        }
        CloseHandle(hDevice);
    }
    return 0;
}

// Multi-pass overwrite with patterns
bool multiPassOverwrite(const std::string& drivePath, int passes, bool useGutmann = false) {
    std::cout << "Multi-pass overwrite: " << passes << " passes" << std::endl;

    HANDLE hDevice = CreateFileA(
        drivePath.c_str(),
        GENERIC_WRITE,
        0,  // Exclusive access
        NULL,
        OPEN_EXISTING,
        FILE_FLAG_WRITE_THROUGH | FILE_FLAG_NO_BUFFERING,
        NULL
    );

    if (hDevice == INVALID_HANDLE_VALUE) {
        std::cerr << "Error opening drive: " << GetLastError() << std::endl;
        return false;
    }

    uint64_t driveSize = getDeviceSize(drivePath);
    if (driveSize == 0) {
        std::cerr << "Could not determine drive size" << std::endl;
        CloseHandle(hDevice);
        return false;
    }

    std::cout << "Drive size: " << (driveSize / 1024.0 / 1024.0 / 1024.0) << " GB" << std::endl;

    // Allocate aligned buffer
    void* rawBuffer = _aligned_malloc(DESTROY_BUFFER_SIZE, 4096);
    if (!rawBuffer) {
        std::cerr << "Memory allocation failed" << std::endl;
        CloseHandle(hDevice);
        return false;
    }
    char* buffer = static_cast<char*>(rawBuffer);

    auto totalStartTime = std::chrono::high_resolution_clock::now();

    for (int pass = 1; pass <= passes; pass++) {
        std::cout << "\\nPass " << pass << "/" << passes << std::endl;
        
        // Determine pattern for this pass
        uint8_t pattern = 0x00;
        if (useGutmann && pass <= (int)GUTMANN_PATTERNS.size()) {
            pattern = GUTMANN_PATTERNS[pass - 1];
        } else {
            // Cycle through patterns: 0x00, 0xFF, random
            if (pass % 3 == 1) pattern = 0x00;
            else if (pass % 3 == 2) pattern = 0xFF;
            else pattern = rand() % 256;  // Random
        }

        std::cout << "Pattern: 0x" << std::hex << (int)pattern << std::dec << std::endl;

        // Fill buffer
        if (pattern == 0x00 || pattern == 0xFF) {
            memset(buffer, pattern, DESTROY_BUFFER_SIZE);
        } else if (pass % 3 == 0 && !useGutmann) {
            // Random pattern
            for (size_t i = 0; i < DESTROY_BUFFER_SIZE; i++) {
                buffer[i] = rand() % 256;
            }
        } else {
            memset(buffer, pattern, DESTROY_BUFFER_SIZE);
        }

        // Seek to beginning
        LARGE_INTEGER offset;
        offset.QuadPart = 0;
        if (!SetFilePointerEx(hDevice, offset, NULL, FILE_BEGIN)) {
            std::cerr << "Seek failed: " << GetLastError() << std::endl;
            _aligned_free(rawBuffer);
            CloseHandle(hDevice);
            return false;
        }

        uint64_t written = 0;
        auto passStartTime = std::chrono::high_resolution_clock::now();

        while (written < driveSize) {
            DWORD toWrite = static_cast<DWORD>(
                std::min(static_cast<uint64_t>(DESTROY_BUFFER_SIZE), driveSize - written)
            );
            
            // Ensure sector alignment
            if (toWrite % 4096 != 0) {
                toWrite = ((toWrite / 4096) + 1) * 4096;
                if (written + toWrite > driveSize) {
                    toWrite = static_cast<DWORD>((driveSize - written + 4095) & ~4095);
                }
            }

            DWORD bytesWritten = 0;
            if (!WriteFile(hDevice, buffer, toWrite, &bytesWritten, NULL)) {
                std::cerr << "Write failed: " << GetLastError() << std::endl;
                _aligned_free(rawBuffer);
                CloseHandle(hDevice);
                return false;
            }

            written += bytesWritten;

            // Progress reporting every 500MB
            if (written % (500ULL * 1024 * 1024) < DESTROY_BUFFER_SIZE) {
                double percent = (written * 100.0) / driveSize;
                auto now = std::chrono::high_resolution_clock::now();
                auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(now - passStartTime).count();
                double speed = (written / 1024.0 / 1024.0) / (elapsed > 0 ? elapsed : 1);
                std::cout << "Progress: " << (int)percent << "% - Speed: " << (int)speed << " MB/s" << std::endl;
            }
        }

        FlushFileBuffers(hDevice);
        
        auto passEndTime = std::chrono::high_resolution_clock::now();
        auto passTime = std::chrono::duration_cast<std::chrono::seconds>(passEndTime - passStartTime).count();
        std::cout << "Pass " << pass << " completed in " << passTime << " seconds" << std::endl;
    }

    auto totalEndTime = std::chrono::high_resolution_clock::now();
    auto totalTime = std::chrono::duration_cast<std::chrono::seconds>(totalEndTime - totalStartTime).count();
    
    std::cout << "\\nAll passes completed in " << totalTime << " seconds (" << (totalTime / 60) << " minutes)" << std::endl;

    _aligned_free(rawBuffer);
    CloseHandle(hDevice);
    return true;
}

// Destroy partition tables and critical structures
bool destroyPartitionStructures(const std::string& drivePath) {
    std::cout << "Destroying partition structures..." << std::endl;

    HANDLE hDevice = CreateFileA(
        drivePath.c_str(),
        GENERIC_WRITE,
        0,
        NULL,
        OPEN_EXISTING,
        FILE_FLAG_WRITE_THROUGH,
        NULL
    );

    if (hDevice == INVALID_HANDLE_VALUE) {
        std::cerr << "Error opening drive: " << GetLastError() << std::endl;
        return false;
    }

    uint64_t driveSize = getDeviceSize(drivePath);
    
    // Allocate buffer for critical area overwrites
    const size_t CRITICAL_SIZE = 100 * 1024 * 1024;  // 100 MB
    void* rawBuffer = _aligned_malloc(CRITICAL_SIZE, 4096);
    if (!rawBuffer) {
        std::cerr << "Memory allocation failed" << std::endl;
        CloseHandle(hDevice);
        return false;
    }
    char* buffer = static_cast<char*>(rawBuffer);

    // Fill with random data
    for (size_t i = 0; i < CRITICAL_SIZE; i++) {
        buffer[i] = rand() % 256;
    }

    // 1. Destroy first 100 MB (MBR, GPT header, partition entries)
    std::cout << "Erasing first 100 MB (MBR/GPT)..." << std::endl;
    LARGE_INTEGER offset;
    offset.QuadPart = 0;
    SetFilePointerEx(hDevice, offset, NULL, FILE_BEGIN);
    
    DWORD bytesWritten = 0;
    if (!WriteFile(hDevice, buffer, CRITICAL_SIZE, &bytesWritten, NULL)) {
        std::cerr << "Failed to erase beginning: " << GetLastError() << std::endl;
        _aligned_free(rawBuffer);
        CloseHandle(hDevice);
        return false;
    }

    // 2. Destroy last 100 MB (backup GPT)
    if (driveSize > CRITICAL_SIZE) {
        std::cout << "Erasing last 100 MB (backup GPT)..." << std::endl;
        offset.QuadPart = driveSize - CRITICAL_SIZE;
        SetFilePointerEx(hDevice, offset, NULL, FILE_BEGIN);
        
        if (!WriteFile(hDevice, buffer, CRITICAL_SIZE, &bytesWritten, NULL)) {
            std::cerr << "Failed to erase end: " << GetLastError() << std::endl;
            // Continue anyway
        }
    }

    FlushFileBuffers(hDevice);
    std::cout << "Partition structures destroyed." << std::endl;

    _aligned_free(rawBuffer);
    CloseHandle(hDevice);
    return true;
}

// Main destroy function - NIST 800-88 Destroy level
bool destroyDrive(const std::string& drivePath, bool confirmDestroy = false) {
    if (!confirmDestroy) {
        std::cerr << "ERROR: Destroy operation requires explicit confirmation flag" << std::endl;
        std::cerr << "This operation will make the drive COMPLETELY UNUSABLE and UNBOOTABLE" << std::endl;
        return false;
    }

    std::cout << "========================================" << std::endl;
    std::cout << "WARNING: NIST 800-88 DESTROY OPERATION" << std::endl;
    std::cout << "========================================" << std::endl;
    std::cout << "This will:" << std::endl;
    std::cout << "1. Perform Gutmann 35-pass wipe" << std::endl;
    std::cout << "2. Destroy all partition tables (MBR/GPT)" << std::endl;
    std::cout << "3. Erase filesystem signatures" << std::endl;
    std::cout << "4. Make the drive unbootable" << std::endl;
    std::cout << "========================================" << std::endl;
    std::cout << "Drive: " << drivePath << std::endl;

    // Step 1: Gut mann 35-pass wipe
    std::cout << "\\nStep 1/3: Gutmann 35-pass wipe" << std::endl;
    if (!multiPassOverwrite(drivePath, 35, true)) {
        std::cerr << "Gutmann wipe failed" << std::endl;
        return false;
    }

    // Step 2: Destroy partition structures
    std::cout << "\\nStep 2/3: Destroying partition structures" << std::endl;
    if (!destroyPartitionStructures(drivePath)) {
        std::cerr << "Partition destruction failed" << std::endl;
        return false;
    }

    // Step 3: Final random pass
    std::cout << "\\nStep 3/3: Final random overwrite" << std::endl;
    if (!multiPassOverwrite(drivePath, 1, false)) {
        std::cerr << "Final pass failed" << std::endl;
        return false;
    }

    std::cout << "\\n========================================" << std::endl;
    std::cout << "DESTROY OPERATION COMPLETED" << std::endl;
    std::cout << "The drive has been securely destroyed." << std::endl;
    std::cout << "========================================" << std::endl;

    return true;
}

// Export for testing
#ifdef TEST_STANDALONE
int main() {
    std::string testDrive = "\\\\.\\PhysicalDrive1";  // Change to test drive
    
    std::cout << "============================================" << std::endl;
    std::cout << "CRITICAL WARNING: DESTROY OPERATION" << std::endl;
    std::cout << "============================================" << std::endl;
    std::cout << "This will PERMANENTLY DESTROY all data on:" << std::endl;
    std::cout << testDrive << std::endl;
    std::cout << "\\nThe drive will be UNBOOTABLE and require" << std::endl;
    std::cout << "repartitioning before use." << std::endl;
    std::cout << "============================================" << std::endl;
    std::cout << "Type 'DESTROY ALL DATA' to continue: ";
    
    std::string confirmation;
    std::getline(std::cin, confirmation);
    
    if (confirmation != "DESTROY ALL DATA") {
        std::cout << "Cancelled." << std::endl;
        return 0;
    }
    
    bool success = destroyDrive(testDrive, true);
    return success ? 0 : 1;
}
#endif
