#include <fstream>
#include <string>
#include <vector>
#include <cstdint>
#include <algorithm>
#include <cstdlib>
#include <cstring>
#include "wipeCommon.h"


bool nistWipe(const std::string& path) {
    std::vector<std::pair<uint8_t, bool>> passes = { {0x00, true} }; // true = random
    return wipeTarget(path, passes);
}
