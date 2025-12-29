const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

// --- NEW: Robust function to parse dates from logs ---
// Handles formats like "28/9/2025, 2:07:09 pm" reliably
function parseDateFromLog(logString) {
  if (!logString) return null;
  const match = logString.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2}):(\d{2}) (am|pm)/);
  if (!match) return null;

  let [, day, month, year, hour, minute, second, ampm] = match.map(Number);
  
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;

  // Month is 0-indexed in JavaScript's Date constructor
  return new Date(year, month - 1, day, hour, minute, second);
}

// --- NEW: Helper function to find timestamps in logs ---
function extractTimesFromLogs(logs) {
  const startTimeLog = logs.find(log => log.includes('Wipe started at'));
  const endTimeLog = logs.find(log => log.includes('Wipe completed at'));
  
  const startTime = parseDateFromLog(startTimeLog);
  const endTime = parseDateFromLog(endTimeLog);

  return { startTime, endTime };
}

// --- NEW: Helper function to calculate duration ---
function calculateDuration(start, end) {
  if (!start || !end) return 'N/A';
  const durationMs = end.getTime() - start.getTime();
  if (durationMs < 0) return 'N/A';

  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes} min ${remainingSeconds} sec`;
  }
  return `${seconds} sec`;
}


async function generatePdfCertificate(jsonCertPath) {
  const cert = JSON.parse(fs.readFileSync(jsonCertPath, 'utf8'));
  const pdfPath = jsonCertPath.replace(/\.json$/, '.pdf');
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);

  // Define colors and fonts
  const primaryBlue = '#4A90E2';
  const lightGray = '#F5F7FA';
  const darkGray = '#333333';
  const successGreen = '#28A745';
  const regularFont = 'Helvetica';
  const boldFont = 'Helvetica-Bold';
  const monoFont = 'Courier'; // Monospaced font for alignment

  const { startTime, endTime } = extractTimesFromLogs(cert.logs);

  // --- RESTORED: Your original section box helper function ---
  function createSectionBox(x, y, width, height, title, content) {
    doc.roundedRect(x, y, width, height, 5).fill(lightGray);
    
    doc.fillColor(primaryBlue).fontSize(14).font(boldFont)
       .text(title, x + 15, y + 15);
    
    let currentY = y + 45;
    content.forEach(item => {
      // --- FIX: Use a monospaced font and padding for perfect alignment ---
      const labelPadded = item.label.padEnd(16, ' ');
      doc.fillColor(darkGray).fontSize(9).font(monoFont)
         .text(`${labelPadded}${item.value}`, x + 15, currentY);
      currentY += 15;
    });
  }

  // --- RESTORED: Your original header design ---
  doc.roundedRect(40, 40, doc.page.width - 80, 80, 5).fill(primaryBlue);
  doc.fillColor('#FFFFFF').fontSize(24).font(boldFont).text('Drop Drive', 60, 55);
  doc.fontSize(16).font(regularFont).text('DATA SANITIZATION CERTIFICATE', 60, 85);

  let currentY = 150;
  const columnWidth = (doc.page.width - 100) / 2;
  
  // --- MODIFIED: Integrated corrected data into your layout ---
  const certInfo = [
    { label: 'Certificate ID', value: cert.certificate_id },
    { label: 'Issue Date', value: new Date(cert.timestamp_utc).toLocaleString() },
    { label: 'Status', value: cert.post_wipe_status.toUpperCase() },
    { label: 'Operator', value: cert.operator },
    { label: 'Wipe Started', value: startTime ? startTime.toLocaleString() : 'N/A' },
    { label: 'Wipe Ended', value: endTime ? endTime.toLocaleString() : 'N/A' },
    { label: 'Duration', value: calculateDuration(startTime, endTime) },
  ];
  createSectionBox(40, currentY, columnWidth, 150, 'Certificate Information', certInfo);

  const deviceInfo = [
    { label: 'Device Name', value: cert.device_info.model },
    { label: 'Device Type', value: cert.device_info.type },
    { label: 'Capacity', value: cert.device_info.capacity },
    { label: 'Serial Number', value: cert.device_info.serial_number }
  ];
  createSectionBox(40 + columnWidth + 20, currentY, columnWidth, 150, 'Device Information', deviceInfo);
  currentY += 170;

  const sanitizationInfo = [
    { label: 'Method', value: cert.erase_method },
    { label: 'Standard', value: cert.nist_profile }
  ];
  createSectionBox(40, currentY, doc.page.width - 80, 70, 'Sanitization Method', sanitizationInfo);
  currentY += 90;

  // Logs Section
  if (cert.logs && cert.logs.length > 0) {
    const logBoxHeight = 120;
    doc.roundedRect(40, currentY, doc.page.width - 80, logBoxHeight, 5).fill(lightGray);
    doc.fillColor(primaryBlue).fontSize(14).font(boldFont).text('Wipe Logs', 55, currentY + 15);
    doc.fillColor(darkGray).fontSize(8).font(monoFont)
       .text(cert.logs.join('\n'), 55, currentY + 45, { width: doc.page.width - 110, height: logBoxHeight - 50 });
    currentY += logBoxHeight + 20;
  }
  
  // Verification Section and QR Code
  const verificationY = currentY;
  const qrCodeSize = 80;

  doc.fillColor(darkGray).font(regularFont).fontSize(9)
     .text('This certificate confirms that the storage device has been securely sanitized according to industry standards. All data has been permanently destroyed and is unrecoverable.',
           40, verificationY, { width: doc.page.width - 100 - qrCodeSize });
  doc.moveDown(1);
  doc.fillColor(successGreen).font(boldFont).fontSize(14)
     .text('VERIFICATION COMPLETE', 40, doc.y);

  try {
    const qrData = JSON.stringify({ id: cert.certificate_id, device: cert.device_info.model });
    const qrImage = await QRCode.toDataURL(qrData, { width: qrCodeSize });
    doc.image(qrImage, doc.page.width - 40 - qrCodeSize, verificationY);
    doc.fontSize(8).fillColor('#888888').text('Scan for verification', doc.page.width - 40 - qrCodeSize, verificationY + qrCodeSize + 5, { align: 'center', width: qrCodeSize });
  } catch (err) { console.warn("QR code generation failed", err); }
  
  // Footer
  doc.fontSize(8).fillColor('#AAAAAA')
     .text(`Generated by SecureWipe Pro v${cert.tool_version} | ${new Date(cert.timestamp_utc).toLocaleString()}`,
           40, doc.page.height - 50, { align: 'center' });

  doc.end();
  await new Promise((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject); });

  return pdfPath;
}

module.exports = { generatePdfCertificate };