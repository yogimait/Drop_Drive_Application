const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const { generatePdfCertificate } = require('./pdfCertificateGenerator'); // import your PDF gen


async function generateWipeCertificate({
  device,
  deviceInfo,    // { serial, model, type, capacity }
  eraseMethod,   // e.g. 'NIST'
  nistProfile,   // e.g. 'Clear', 'Purge', 'Destroy'
  postWipeStatus,// 'success' or 'failure'
  logs = [],
  toolVersion = "1.0.0"
}) {
  const certificate = {
    certificate_id: uuidv4(),
    timestamp_utc: new Date().toISOString(),
    operator: os.userInfo().username || "Operator",
    device_info: {
      serial_number: deviceInfo?.serial || "unknown",
      model: deviceInfo?.model || "unknown",
      type: deviceInfo?.type || "unknown",
      capacity: deviceInfo?.capacity || "unknown"
    },
    erase_method: eraseMethod,
    nist_profile: nistProfile,
    post_wipe_status: postWipeStatus,
    logs: logs,
    tool_version: toolVersion
  };

  // Ensure certificates/ folder exists
  const certFolder = path.resolve(__dirname, '../certificates');
  if (!fs.existsSync(certFolder)) fs.mkdirSync(certFolder, { recursive: true });

  const certFilename = `certificate_${certificate.certificate_id}.json`;
  const certPath = path.join(certFolder, certFilename);

  fs.writeFileSync(certPath, JSON.stringify(certificate, null, 2), 'utf8');

  const pdfPath = await generatePdfCertificate(certPath);

  // Return both file paths if you want
  return { certPath, pdfPath };
}


module.exports = { generateWipeCertificate };