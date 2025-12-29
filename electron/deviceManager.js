// electron/deviceManager.js
const drivelist = require('drivelist');
const disk = require('diskusage');

/**
 * Lists all drives connected to the system.
 * Filters removable and system drives with useful info.
 */
async function listDrives() {
  try {
    const drives = await drivelist.list();
    // For each mountpoint, get free space
    for (const drive of drives) {
      for (const mp of drive.mountpoints) {
        try {
          const { available, free, total } = disk.checkSync(mp.path);
          mp.total = total;
          mp.free = free;
        } catch (e) {
          mp.total = null;
          mp.free = null;
        }
      }
    }
    // Map to return info useful for your UI and backend:
    return drives.map(drive => ({
      device: drive.device,                // e.g. '\\\\.\\PhysicalDrive1' (Win), '/dev/sdb' (Linux)
      description: drive.description,      // e.g. 'SanDisk USB Flash Drive'
      size: drive.size,                    // in bytes, can format for display
      mountpoints: drive.mountpoints,      // e.g. [{path: 'E:\\'}] for Windows, or /media/.. for Linux
      isSystem: drive.isSystem,            // true for system boot partitions
      isRemovable: drive.isRemovable,      // true for USB sticks and SD cards
      isReadOnly: drive.isReadOnly,        // can't wipe if true
      isCard: drive.isCard,                // for SD cards
      busType: drive.busType,              // USB, SATA, NVMe etc.
    }));
  } catch (error) {
    console.error('[DeviceManager] Error listing drives:', error);
    return [];
  }
}

module.exports = { listDrives };
