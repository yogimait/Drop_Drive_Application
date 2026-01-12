const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const { app } = require('electron');
const { generatePdfCertificate } = require('./pdfCertificateGenerator');
const { insertCertificate, isDatabaseReady } = require('./db/database');

// SINGLE SOURCE OF TRUTH for certificate directory
const CERT_DIR = path.join(app.getPath('userData'), 'certificates');

// Ensure certificate directory exists
function ensureCertDir() {
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
  }
  return CERT_DIR;
}

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
  // CRITICAL: Block certificate generation if wipe was not successful
  if (postWipeStatus !== 'success') {
    throw new Error(`Certificate blocked: wipe status was '${postWipeStatus}', not 'success'`);
  }

  // CRITICAL: Never generate real certificates for simulated wipes
  if (simulated) {
    throw new Error('Certificate blocked: cannot generate certificate for simulated/dry-run wipe');
  }

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

  // Ensure certificates folder exists (single source of truth)
  const certFolder = ensureCertDir();

  // Use the same UUID for filename consistency
  const certFilename = `certificate_${certificateId}.json`;
  const certPath = path.join(certFolder, certFilename);

  // Write JSON certificate (absolute path)
  fs.writeFileSync(certPath, JSON.stringify(certificate, null, 2), 'utf8');

  // Verify JSON file was created
  if (!fs.existsSync(certPath)) {
    throw new Error(`Certificate JSON file was not created at: ${certPath}`);
  }

  // Generate PDF certificate with try/catch (PDFKit can fail silently)
  let pdfPath;
  try {
    pdfPath = await generatePdfCertificate(certPath);
  } catch (pdfError) {
    console.error('[CertGen] PDF generation failed:', pdfError);
    // Clean up orphaned JSON file
    try { fs.unlinkSync(certPath); } catch (e) { /* ignore */ }
    throw new Error(`Certificate PDF generation failed: ${pdfError.message}`);
  }

  // Verify PDF file was created
  if (!fs.existsSync(pdfPath)) {
    // Clean up orphaned JSON file
    try { fs.unlinkSync(certPath); } catch (e) { /* ignore */ }
    throw new Error(`Certificate PDF file was not created at: ${pdfPath}`);
  }

  // CRITICAL: Only insert into DB AFTER both files are verified to exist
  if (isDatabaseReady()) {
    try {
      insertCertificate({
        id: certificateId,  // Same UUID as JSON/PDF filename
        created_at: timestampUtc,  // ISO string
        wipe_type: nistProfile,  // Clear/Purge/Destroy
        status: postWipeStatus,  // success (only value allowed to reach here)
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
      // Log error but don't break - files exist even if DB fails
      console.error(`[CertGen] Failed to save certificate to DB (non-fatal):`, dbError);
    }
  } else {
    console.warn('[CertGen] Database not ready, skipping DB insert');
  }

  // Log successful generation (if wipeLogger is available)
  try {
    const wipeLogger = require('./wipeLogger');
    wipeLogger.certificateGenerated(certificateId, certPath, pdfPath);
  } catch (e) { /* wipeLogger not required */ }

  // Return both file paths (absolute)
  return { certPath, pdfPath, certificateId };
}

// Export CERT_DIR for consistency across modules
module.exports = { generateWipeCertificate, CERT_DIR, ensureCertDir };

