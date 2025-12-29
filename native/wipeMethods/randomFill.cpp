#include <fstream>
#include <cstdlib>
#include <cstdint>

bool randomFill(const std::string& path) {
    std::fstream file(path, std::ios::in | std::ios::out | std::ios::binary);
    if (!file.is_open())
        return false;

    file.seekg(0, std::ios::end);
    std::streamoff filesize = file.tellg();
    file.seekp(0, std::ios::beg);

    const size_t BUF_SIZE = 4096;
    char buffer[BUF_SIZE];

    for (std::streamoff written = 0; written < filesize; ) {
        size_t toWrite = std::min(static_cast<std::streamoff>(BUF_SIZE), filesize - written);
        for (size_t i = 0; i < toWrite; ++i)
            buffer[i] = rand() % 256;
        file.write(buffer, toWrite);
        written += toWrite;
    }
    file.close();
    return true;
}
