#include <fstream>
#include <string>
#include <vector>
#include <cstdint>
#include <algorithm>
#include <cstdlib>
#include <cstring>
#include "wipeCommon.h"


bool dodWipe(const std::string& path) {
    std::vector<std::pair<uint8_t, bool>> passes = {
        {0x00, false}, // zeros
        {0xFF, false}, // ones
        {0x00, true}   // random
    };
    return wipeTarget(path, passes);
}
