const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const { generatePdfCertificate } = require('./pdfCertificateGenerator');
const { insertCertificate, isDatabaseReady } = require('./db/database');


async function generateWipeCertificate({
  device,
  deviceInfo,    // { serial, model, type, capacity }
  eraseMethod,   // e.g. 'NIST'
  nistProfile,   // e.g. 'Clear', 'Purge', 'Destroy'
  postWipeStatus,// 'success' or 'failure'
  logs = [],
  toolVersion = "1.0.0",
  simulated = false  // Whether this was a dry run
}) {
  // Generate UUID once - used for JSON, PDF, and DB primary key
  const certificateId = uuidv4();
  const timestampUtc = new Date().toISOString();

  const certificate = {
    certificate_id: certificateId,
    timestamp_utc: timestampUtc,
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

  // Use the same UUID for filename consistency
  const certFilename = `certificate_${certificateId}.json`;
  const certPath = path.join(certFolder, certFilename);

  // Write JSON certificate (absolute path)
  fs.writeFileSync(certPath, JSON.stringify(certificate, null, 2), 'utf8');

  // Generate PDF certificate (returns absolute path)
  const pdfPath = await generatePdfCertificate(certPath);

  // Insert into SQLite database
  // This is SYNCHRONOUS - caller should have try/catch in main wipe flow
  if (isDatabaseReady()) {
    try {
      insertCertificate({
        id: certificateId,  // Same UUID as JSON/PDF filename
        created_at: timestampUtc,  // ISO string
        wipe_type: nistProfile,  // Clear/Purge/Destroy
        status: postWipeStatus,  // success/simulated/unsupported/failed
        device_model: deviceInfo?.model || null,
        device_size: deviceInfo?.capacity || null,
        device_type: deviceInfo?.type || null,
        device_serial: deviceInfo?.serial || null,
        erase_method: eraseMethod,
        json_path: certPath,  // Absolute path
        pdf_path: pdfPath,    // Absolute path
        simulated: simulated,
        user_id: null  // Future use for cloud sync
      });
      console.log(`[CertGen] Certificate ${certificateId} saved to database`);
    } catch (dbError) {
      // Log error but never break the wipe result
      console.error(`[CertGen] Failed to save certificate to DB (non-fatal):`, dbError);
    }
  } else {
    console.warn('[CertGen] Database not ready, skipping DB insert');
  }

  // Return both file paths (absolute)
  return { certPath, pdfPath, certificateId };
}


module.exports = { generateWipeCertificate };
