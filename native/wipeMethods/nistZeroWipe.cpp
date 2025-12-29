#include <fstream>
#include <string>
#include <vector>
#include <cstdint>
#include <algorithm>
#include <cstdlib>
#include <cstring>
#include "wipeCommon.h"

bool nistZeroWipe(const std::string& path) {
    std::vector<std::pair<uint8_t, bool>> passes = { {0x00, false} }; // false = no random, zeros
    return wipeTarget(path, passes);
}
