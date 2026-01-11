const { listDrives } = require('../electron/deviceManager');

listDrives().then(drives => {
  console.log(drives);
});
