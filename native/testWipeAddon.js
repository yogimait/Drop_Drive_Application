const wipeAddon = require('./build/Release/wipeAddon.node');
// const usbPath = '\\\\.\\PhysicalDrive1'
console.log(wipeAddon.wipeFile('./test/test_img.png', 'nist'));
// console.log(wipeAddon.wipeFile('./test/test_pdf.pdf', 'nistzero'));
// console.log(wipeAddon.wipeFile('./test/test_video.mp4', 'dod'));


