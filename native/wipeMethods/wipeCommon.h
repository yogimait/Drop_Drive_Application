#pragma once
#include <cstdlib>
#include <cstring>
#include <cstdint>
#include <vector>
#include <string>
#include <fstream>
#include <algorithm>

// Helper to fill buffer with zeros, ones, or random
inline void fillBuffer(char* buffer, size_t size, uint8_t pattern, bool random) {
    if (!random) {
        memset(buffer, pattern, size);
    } else {
        for (size_t i = 0; i < size; ++i)
            buffer[i] = rand() % 256;
    }
}

// General wipe function
inline bool wipeTarget(const std::string& path, const std::vector<std::pair<uint8_t, bool>>& passes) {
    std::fstream file(path, std::ios::in | std::ios::out | std::ios::binary);
    if (!file.is_open()) return false;

    file.seekg(0, std::ios::end);
    std::streamoff filesize = file.tellg();
    file.seekp(0, std::ios::beg);

    const size_t BUF_SIZE = 4096;
    char buffer[BUF_SIZE];

    for (const auto& pass : passes) {
        file.seekp(0, std::ios::beg);
        std::streamoff written = 0;
        while (written < filesize) {
            size_t toWrite = std::min(static_cast<std::streamoff>(BUF_SIZE), filesize - written);
            fillBuffer(buffer, toWrite, pass.first, pass.second);
            file.write(buffer, toWrite);
            written += toWrite;
        }
        file.flush();
    }
    file.close();
    return true;
}