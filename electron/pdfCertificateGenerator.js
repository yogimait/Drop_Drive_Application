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
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);

  // --- Fonts & Colors ---
  const fontMain = 'Times-Roman';
  const fontBold = 'Times-Bold';
  const fontMono = 'Courier';
  const colorDark = '#1a1a1a';
  const colorGray = '#666666';
  const colorLine = '#dddddd';

  const { startTime, endTime } = extractTimesFromLogs(cert.logs);

  // --- 1. Formal Border (Double Line) ---
  const borderPadding = 20;
  doc.lineWidth(3).strokeColor(colorDark)
    .rect(borderPadding, borderPadding, doc.page.width - borderPadding * 2, doc.page.height - borderPadding * 2)
    .stroke();

  doc.lineWidth(1).strokeColor(colorDark)
    .rect(borderPadding + 4, borderPadding + 4, doc.page.width - (borderPadding * 2 + 8), doc.page.height - (borderPadding * 2 + 8))
    .stroke();

  // --- 2. Header Section ---
  doc.moveDown(2);

  // Optional: Add Logo if available, otherwise text logo
  doc.font('Helvetica-Bold').fontSize(24).fillColor(colorDark)
    .text('DROP DRIVE', { align: 'center', letterSpacing: 2 });

  doc.moveDown(0.5);
  doc.font(fontBold).fontSize(28).fillColor('#000000')
    .text('CERTIFICATE OF DATA DESTRUCTION', { align: 'center' });

  doc.moveDown(0.5);
  doc.font(fontMain).fontSize(12).fillColor(colorGray)
    .text(`Certificate ID: ${cert.certificate_id}`, { align: 'center' });

  // Divider
  doc.moveDown(1.5);
  doc.lineWidth(1).strokeColor(colorDark)
    .moveTo(100, doc.y).lineTo(doc.page.width - 100, doc.y).stroke();

  // --- 3. Certification Statement ---
  doc.moveDown(2);
  doc.font(fontMain).fontSize(12).fillColor(colorDark)
    .text('This document certifies that the data storage device described below has been sanitized in accordance with the specified techniques and standards. All addressable locations have been overwritten and verified, rendering the data irretrievable.', {
      align: 'center',
      width: 450,
      align: 'justify'
    });

  // --- 4. Main Data Grid ---
  doc.moveDown(2.5);
  let y = doc.y;
  const col1X = 70;
  const col2X = 300;
  const rowHeight = 25;

  // Helper row function
  function drawRow(label, value, isBold = false) {
    doc.font(fontBold).fontSize(11).fillColor(colorDark).text(label, col1X, y);
    doc.font(isBold ? fontBold : fontMono).fontSize(11).fillColor(colorDark).text(value, col1X + 110, y);

    // Draw line
    doc.lineWidth(0.5).strokeColor(colorLine)
      .moveTo(col1X, y + 18).lineTo(doc.page.width - 70, y + 18).stroke();

    y += rowHeight;
  }

  // Draw two columns of data conceptually, but visually a clean list
  const startY = y;

  // Left Column Data (Device)
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#333333').text('DEVICE DETAILS', col1X, y - 5);
  y += 20; // smaller spacing
  drawRow('Model Name:', cert.device_info.model, true);
  drawRow('Serial Number:', cert.device_info.serial_number);
  drawRow('Capacity:', cert.device_info.capacity);
  drawRow('Interface:', cert.device_info.type);

  y += 20;

  // Right Column Data (Process) - Reset Y for visual balance? No, let's stack for PDF stability
  // Actually, let's keep it linear for clarity in report style
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#333333').text('SANITIZATION PROCESS', col1X, y - 5);
  y += 20;
  drawRow('Method:', cert.erase_method, true);
  drawRow('Standard:', cert.nist_profile);
  drawRow('Date:', new Date(cert.timestamp_utc).toLocaleDateString());
  drawRow('Duration:', calculateDuration(startTime, endTime));
  drawRow('Status:', cert.post_wipe_status.toUpperCase(), true);

  // --- 5. Verification & Signature Area ---
  doc.moveDown(4);
  y = doc.y + 40;

  // Signature Lines -> "Operator" and "Verifier"
  const sigY = y;
  doc.lineWidth(1).strokeColor(colorDark)
    .moveTo(70, sigY).lineTo(250, sigY).stroke(); // Line 1

  doc.lineWidth(1).strokeColor(colorDark)
    .moveTo(350, sigY).lineTo(530, sigY).stroke(); // Line 2

  doc.font(fontMain).fontSize(10).text('Authorized Technician', 70, sigY + 10, { width: 180, align: 'center' });
  doc.font(fontMain).fontSize(10).text('Compliance Officer', 350, sigY + 10, { width: 180, align: 'center' });

  // --- 6. QR Code (Bottom Right) ---
  try {
    const qrData = JSON.stringify({ id: cert.certificate_id, device: cert.device_info.model });
    const qrImage = await QRCode.toDataURL(qrData, { width: 90, margin: 1 });
    // Place QR in bottom corner
    doc.image(qrImage, doc.page.width - 130, doc.page.height - 150);
  } catch (err) { }

  // --- 7. Footer ---
  const bottomY = doc.page.height - 80;
  doc.fontSize(8).font('Helvetica').fillColor('#888888')
    .text('DropDrive Secure Wipe Pro v' + cert.tool_version, 50, bottomY, { align: 'center' });

  doc.text(`Generated: ${new Date().toLocaleString()}`, 50, bottomY + 12, { align: 'center' });

  doc.end();
  await new Promise((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject); });

  return pdfPath;
}

module.exports = { generatePdfCertificate };