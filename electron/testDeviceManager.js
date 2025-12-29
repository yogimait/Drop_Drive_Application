const { listDrives } = require('./deviceManager');

listDrives().then(drives => {
  console.log(drives);
});
