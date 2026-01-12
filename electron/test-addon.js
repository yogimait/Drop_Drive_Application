const addon = require('../native/build/Release/wipeAddon.node');
const fs = require('fs');
const path = require('path');

// Create test file
const testFile = path.join(__dirname, 'test-wipe.txt');
   fs.writeFileSync(testFile, 'This is test data to be wiped');

   console.log('Original content:', fs.readFileSync(testFile, 'utf8'));

   // Test zero wipe
   const result = addon.wipeFile(testFile, 'zero');
   console.log('Wipe result:', result);

   // Check if content is wiped
   try {
     const content = fs.readFileSync(testFile, 'utf8');
     console.log('Content after wipe:', content.substring(0, 50));
   } catch (error) {
     console.log('File deleted or inaccessible after wipe');
   }

   // Cleanup
   if (fs.existsSync(testFile)) {
     fs.unlinkSync(testFile);
   }