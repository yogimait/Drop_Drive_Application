import { generateWipeCertificate } from '../electron/certificateGenerator.js';



async function testCert() {
  console.log('Running certificate generation test...');
  try {
    const { certPath, pdfPath } = await generateWipeCertificate({
      device: '\\\\.\\PhysicalDrive1',
      deviceInfo: {
        serial: 'ABC-123-XYZ',
        model: 'SanDisk Ultra USB 3.0',
        type: 'USB',
        capacity: '128 GB'
      },
      eraseMethod: 'NIST 800-88 Purge',
      nistProfile: 'Purge',
      postWipeStatus: 'success',
      // Realistic logs to test the new timestamp and duration feature
      logs: [
        `Wipe started at ${new Date(Date.now() - 180000).toLocaleString()}`, // 3 minutes ago
        'Unmounting drive...',
        'Drive unmounted successfully',
        'Native wipe result: Zero fill wipe completed',
        'Drive remounted successfully',
        `Wipe completed at ${new Date().toLocaleString()}` // Now
      ],
      toolVersion: "2.1.0"
    });

    console.log('✅ Test complete!');
    console.log('Certificate JSON saved to:', certPath);
    console.log('PDF Certificate saved to:', pdfPath);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}
testCert();
