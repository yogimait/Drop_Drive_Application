#include <napi.h>
#include <string>
#include <vector>
#include <iostream>
#include <chrono>
#include <algorithm>

// Forward declarations for purge and destroy methods
extern bool ataSecureErase(const std::string& drivePath, bool useEnhanced);
extern bool nvmeSanitize(const std::string& drivePath, const std::string& action);
extern bool cryptoErase(const std::string& drivePath);
extern bool destroyDrive(const std::string& drivePath, bool confirmDestroy);

#ifdef _WIN32
    #include <windows.h>
    #include <winioctl.h>
#else
    #include <sys/stat.h>
    #include <fcntl.h>
    #include <unistd.h>
    #include <sys/ioctl.h>
    #ifdef __linux__
        #include <linux/fs.h>
    #endif
#endif

// CRITICAL: These must be powers of 2 and sector-aligned
constexpr size_t SECTOR_SIZE = 4096;  // Use 4KB sectors (safe for all drives)
constexpr size_t BUFFER_SIZE = 128 * 1024 * 1024;  // 128MB for maximum throughput
constexpr size_t NUM_BUFFERS = 2;  // Reduced to 2 for stability
constexpr size_t PROGRESS_INTERVAL = 500 * 1024 * 1024; // Report every 500MB

static uint64_t getDeviceSize(const std::string& path) {
#ifdef _WIN32
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
#else
    struct stat st;
    if (stat(path.c_str(), &st) == 0) {
        if (S_ISBLK(st.st_mode)) {
            int fd = open(path.c_str(), O_RDONLY);
            if (fd != -1) {
                uint64_t size = 0;
#ifdef __linux__
                if (ioctl(fd, BLKGETSIZE64, &size) == 0) {
                    close(fd);
                    return size;
                }
#endif
                close(fd);
            }
        }
        return st.st_size;
    }
#endif
    return 0;
}

bool optimizedWipe(const std::string& path) {
    std::cout << "\n========================================" << std::endl;
    std::cout << "HIGH-PERFORMANCE Wipe Starting" << std::endl;
    std::cout << "Path: " << path << std::endl;
    
    uint64_t totalSize = getDeviceSize(path);
    if (totalSize == 0) {
        std::cout << "ERROR: Could not determine device size" << std::endl;
        return false;
    }
    
    std::cout << "Device size: " << (totalSize / 1024.0 / 1024.0 / 1024.0) << " GB" << std::endl;
    std::cout << "Buffer: " << (BUFFER_SIZE / 1024 / 1024) << " MB per operation" << std::endl;
    std::cout << "========================================\n" << std::endl;

#ifdef _WIN32
    // CRITICAL: On Windows, we must dismount all volumes on the physical drive
    // BEFORE we can write to it, even with admin rights.
    
    // Step 1: Extract drive number from path (e.g., "\\.\PhysicalDrive1" -> 1)
    int driveNumber = -1;
    if (path.find("PhysicalDrive") != std::string::npos) {
        size_t pos = path.find("PhysicalDrive");
        driveNumber = std::stoi(path.substr(pos + 13));
    }
    
    // Step 2: Enumerate and dismount all volumes on this physical drive
    if (driveNumber >= 0) {
        std::cout << "Dismounting volumes on drive " << driveNumber << "..." << std::endl;
        
        // Try common drive letters (C: through Z:)
        for (char letter = 'A'; letter <= 'Z'; letter++) {
            std::string volumePath = std::string("\\\\.\\") + letter + ":";
            
            HANDLE hVolume = CreateFileA(
                volumePath.c_str(),
                GENERIC_READ | GENERIC_WRITE,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                NULL,
                OPEN_EXISTING,
                0,
                NULL
            );
            
            if (hVolume == INVALID_HANDLE_VALUE) {
                continue; // Volume doesn't exist
            }
            
            // Check if this volume is on our target drive
            VOLUME_DISK_EXTENTS diskExtents;
            DWORD bytesReturned;
            if (DeviceIoControl(hVolume, IOCTL_VOLUME_GET_VOLUME_DISK_EXTENTS,
                               NULL, 0, &diskExtents, sizeof(diskExtents),
                               &bytesReturned, NULL)) {
                
                if (diskExtents.NumberOfDiskExtents > 0 &&
                    diskExtents.Extents[0].DiskNumber == (DWORD)driveNumber) {
                    
                    std::cout << "  Found volume " << letter << ": on target drive" << std::endl;
                    
                    // Lock the volume
                    if (DeviceIoControl(hVolume, FSCTL_LOCK_VOLUME, NULL, 0, NULL, 0, &bytesReturned, NULL)) {
                        std::cout << "    Locked volume " << letter << ":" << std::endl;
                        
                        // Dismount the volume
                        if (DeviceIoControl(hVolume, FSCTL_DISMOUNT_VOLUME, NULL, 0, NULL, 0, &bytesReturned, NULL)) {
                            std::cout << "    Dismounted volume " << letter << ":" << std::endl;
                        } else {
                            std::cout << "    Warning: Could not dismount " << letter << ": (error " << GetLastError() << ")" << std::endl;
                        }
                    } else {
                        std::cout << "    Warning: Could not lock " << letter << ": (error " << GetLastError() << ")" << std::endl;
                    }
                }
            }
            
            CloseHandle(hVolume);
        }
    }
    
    // Step 3: Now open the physical drive for writing with NO_BUFFERING for maximum speed
    HANDLE hDevice = CreateFileA(
        path.c_str(),
        GENERIC_WRITE,
        FILE_SHARE_READ | FILE_SHARE_WRITE,
        NULL,
        OPEN_EXISTING,
        FILE_FLAG_NO_BUFFERING | FILE_FLAG_WRITE_THROUGH,  // Direct writes, bypass cache
        NULL
    );
    
    if (hDevice == INVALID_HANDLE_VALUE) {
        DWORD error = GetLastError();
        std::cout << "ERROR: Cannot open device. Error code: " << error << std::endl;
        if (error == 5) {
            std::cout << "  This is ACCESS_DENIED. Possible causes:" << std::endl;
            std::cout << "  1. Not running as Administrator" << std::endl;
            std::cout << "  2. Drive is in use by another program" << std::endl;
            std::cout << "  3. Antivirus is blocking access" << std::endl;
        }
        return false;
    }
    
    std::cout << "Device opened successfully" << std::endl;
    
    // Declare bytesReturned for later DeviceIoControl calls
    DWORD bytesReturned;

    
    // Allocate aligned buffer for FILE_FLAG_NO_BUFFERING (requires sector alignment)
    void* rawBuffer = _aligned_malloc(BUFFER_SIZE, SECTOR_SIZE);
    if (!rawBuffer) {
        std::cout << "ERROR: Memory allocation failed" << std::endl;
        CloseHandle(hDevice);
        return false;
    }
    char* buffer = static_cast<char*>(rawBuffer);
    memset(buffer, 0, BUFFER_SIZE);  // Zero-fill the buffer
    
    uint64_t written = 0;
    auto startTime = std::chrono::high_resolution_clock::now();
    
    std::cout << "Starting write operations..." << std::endl;

    
    while (written < totalSize) {
        DWORD toWrite = static_cast<DWORD>(
            std::min(static_cast<uint64_t>(BUFFER_SIZE), totalSize - written)
        );
        
        // FILE_FLAG_NO_BUFFERING requires sector-aligned write sizes
        if (toWrite % SECTOR_SIZE != 0) {
            toWrite = ((toWrite / SECTOR_SIZE) + 1) * SECTOR_SIZE;
            // Don't exceed total size
            if (written + toWrite > totalSize) {
                toWrite = static_cast<DWORD>((totalSize - written + SECTOR_SIZE - 1) & ~(SECTOR_SIZE - 1));
            }
        }
        DWORD bytesWritten = 0;
        
        // Simple synchronous write - but with LARGE buffers
        if (!WriteFile(hDevice, buffer, toWrite, &bytesWritten, NULL)) {
            DWORD error = GetLastError();
            std::cout << "\nERROR: WriteFile failed with error: " << error << std::endl;
            CloseHandle(hDevice);
            return false;
        }
        
        if (bytesWritten != toWrite) {
            std::cout << "\nWARNING: Partial write - " << bytesWritten << " of " << toWrite << " bytes" << std::endl;
        }
        
        written += bytesWritten;
        
        // Progress reporting - only every 1GB to minimize overhead
        if (written % (1024ULL * 1024 * 1024) < BUFFER_SIZE || written >= totalSize) {
            auto now = std::chrono::high_resolution_clock::now();
            auto totalElapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - startTime).count();
            double totalElapsedSec = totalElapsed / 1000.0;
            double writtenMB = written / 1024.0 / 1024.0;
            double currentSpeed = writtenMB / totalElapsedSec;
            int progressPercent = static_cast<int>((written * 100) / totalSize);
            
            std::cout << "Progress: " << progressPercent << "% (" 
                      << static_cast<int>(writtenMB) << " MB) - Speed: " 
                      << static_cast<int>(currentSpeed) << " MB/s" << std::endl;
        }
    }
    
    std::cout << "\nFlushing buffers..." << std::endl;
    FlushFileBuffers(hDevice);
    
    // Unlock volume
    DeviceIoControl(hDevice, FSCTL_UNLOCK_VOLUME, NULL, 0, NULL, 0, &bytesReturned, NULL);
    
    // Free aligned buffer
    _aligned_free(rawBuffer);
    
    CloseHandle(hDevice);
    
    auto endTime = std::chrono::high_resolution_clock::now();
    auto totalTime = std::chrono::duration_cast<std::chrono::seconds>(endTime - startTime).count();
    double avgSpeed = (totalSize / 1024.0 / 1024.0) / totalTime;
    
    std::cout << "\n========================================" << std::endl;
    std::cout << "WIPE COMPLETED SUCCESSFULLY!" << std::endl;
    std::cout << "Total time: " << totalTime << " seconds (" << (totalTime / 60) << " minutes)" << std::endl;
    std::cout << "Average speed: " << static_cast<int>(avgSpeed) << " MB/s" << std::endl;
    std::cout << "========================================\n" << std::endl;
    
    return true;
    
#else
    // Linux implementation
    int fd = open(path.c_str(), O_WRONLY | O_SYNC);
    if (fd == -1) {
        std::cout << "ERROR: Cannot open device" << std::endl;
        return false;
    }
    
    std::vector<char> buffer(BUFFER_SIZE, 0);
    uint64_t written = 0;
    auto startTime = std::chrono::high_resolution_clock::now();
    
    while (written < totalSize) {
        size_t toWrite = std::min(static_cast<uint64_t>(BUFFER_SIZE), totalSize - written);
        ssize_t result = write(fd, buffer.data(), toWrite);
        
        if (result <= 0) {
            std::cout << "Write failed" << std::endl;
            close(fd);
            return false;
        }
        
        written += result;
        
        if (written % PROGRESS_INTERVAL == 0) {
            auto now = std::chrono::high_resolution_clock::now();
            auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(now - startTime).count();
            double speed = (written / 1024.0 / 1024.0) / elapsed;
            std::cout << "Progress: " << (written * 100 / totalSize) << "% - Speed: " 
                      << speed << " MB/s" << std::endl;
        }
    }
    
    fsync(fd);
    close(fd);
    return true;
#endif
}

Napi::Value WipeFile(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsString()) {
        Napi::TypeError::New(env, "Path and method required").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string path = info[0].As<Napi::String>();
    std::string method = info[1].As<Napi::String>();
    
    try {
        bool result = optimizedWipe(path);
        
        if (result) {
            return Napi::String::New(env, "Wipe completed successfully");
        } else {
            return Napi::String::New(env, "Wipe failed");
        }
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}

Napi::Value TestAddon(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    std::cout << "=== HIGH-PERFORMANCE Wipe Addon ===" << std::endl;
    std::cout << "Buffer Size: " << (BUFFER_SIZE / 1024 / 1024) << " MB" << std::endl;
    std::cout << "Expected speed: 50-150 MB/s (depending on USB interface)" << std::endl;
    return Napi::String::New(env, "Addon ready - 32MB buffer size");
}

Napi::Value GetDeviceInfo(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Device path required").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string path = info[0].As<Napi::String>();
    Napi::Object deviceInfo = Napi::Object::New(env);
    
    uint64_t size = getDeviceSize(path);
    deviceInfo.Set("path", path);
    deviceInfo.Set("size", static_cast<double>(size));
    deviceInfo.Set("sizeGB", size / 1024.0 / 1024.0 / 1024.0);
    
    return deviceInfo;
}

// N-API wrapper for ATA Secure Erase
Napi::Value ATASecureErase(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Device path required").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string path = info[0].As<Napi::String>();
    bool enhanced = (info.Length() >= 2 && info[1].IsBoolean()) ? info[1].As<Napi::Boolean>().Value() : false;
    
    try {
        bool result = ataSecureErase(path, enhanced);
        return Napi::Boolean::New(env, result);
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}

// N-API wrapper for NVMe Sanitize
Napi::Value NVMeSanitize(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsString()) {
        Napi::TypeError::New(env, "Device path and action required").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string path = info[0].As<Napi::String>();
    std::string action = info[1].As<Napi::String>();
    
    try {
        bool result = nvmeSanitize(path, action);
        return Napi::Boolean::New(env, result);
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}

// N-API wrapper for Crypto Erase
Napi::Value CryptoErase(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Device path required").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string path = info[0].As<Napi::String>();
    
    try {
        bool result = cryptoErase(path);
        return Napi::Boolean::New(env, result);
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}

// N-API wrapper for Destroy Drive
Napi::Value DestroyDrive(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Device path required").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string path = info[0].As<Napi::String>();
    bool confirm = (info.Length() >= 2 && info[1].IsBoolean()) ? info[1].As<Napi::Boolean>().Value() : false;
    
    try {
        bool result = destroyDrive(path, confirm);
        return Napi::Boolean::New(env, result);
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    std::cout << "Initializing HIGH-PERFORMANCE Wipe Addon with NIST 800-88 Purge/Destroy" << std::endl;
    
    // Clear methods (existing)
    exports.Set("wipeFile", Napi::Function::New(env, WipeFile));
    exports.Set("testAddon", Napi::Function::New(env, TestAddon));
    exports.Set("getDeviceInfo", Napi::Function::New(env, GetDeviceInfo));
    
    // Purge methods (new)
    exports.Set("ataSecureErase", Napi::Function::New(env, ATASecureErase));
    exports.Set("nvmeSanitize", Napi::Function::New(env, NVMeSanitize));
    exports.Set("cryptoErase", Napi::Function::New(env, CryptoErase));
    
    // Destroy method (new)
    exports.Set("destroyDrive", Napi::Function::New(env, DestroyDrive));
    
    return exports;
}

NODE_API_MODULE(wipeAddon, Init)