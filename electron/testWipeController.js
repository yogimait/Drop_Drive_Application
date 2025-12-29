const { startWipe } = require('./wipeController');

startWipe({ device: '../native/test/test_img.png', method: 'zero', label: 'Test File' })
  .then(result => console.log(result));
