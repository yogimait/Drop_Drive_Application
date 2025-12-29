#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Validate ISO 8601 UTC
function isIsoUtc(s) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3,})?Z$/.test(s);
}

function verifyOne(jsonPath) {
  let cert, passed = true;
  let messages = [];

  // Check file exists and is readable JSON
  try {
    cert = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch (err) {
    messages.push(`FAIL: ${path.basename(jsonPath)} --- Invalid JSON`);
    return { passed: false, messages };
  }

  // Required fields
  const requiredFields = [
    'certificate_id',
    'timestamp_utc',
    'device_info',
    'erase_method',
    'post_wipe_status',
    'nist_profile'
  ];
  for (const f of requiredFields) {
    if (!cert[f]) {
      messages.push(`FAIL: ${path.basename(jsonPath)} --- Missing required field: ${f}`);
      return { passed: false, messages };
    }
  }

  // Device info
  const devReq = ['serial_number', 'model', 'type', 'capacity'];
  for (const df of devReq) {
    if (!cert.device_info[df]) {
      messages.push(`FAIL: ${path.basename(jsonPath)} --- Missing device_info field: ${df}`);
      return { passed: false, messages };
    }
  }

  // Timestamp validity
  if (!isIsoUtc(cert.timestamp_utc)) {
    messages.push(`FAIL: ${path.basename(jsonPath)} --- Invalid timestamp format (must be ISO 8601 UTC)`);
    return { passed: false, messages };
  }

  // nist_profile validity
  const validProfiles = ['Clear', 'Purge', 'Destroy'];
  if (!validProfiles.includes(cert.nist_profile)) {
    messages.push(`FAIL: ${path.basename(jsonPath)} --- nist_profile must be one of: ${validProfiles.join(', ')}`);
    return { passed: false, messages };
  }

  messages.push(`PASS: ${path.basename(jsonPath)}`);
  return { passed: true, messages };
}

function main() {
  const certDir = path.resolve(__dirname, '../certificates');
  if (!fs.existsSync(certDir) || !fs.lstatSync(certDir).isDirectory()) {
    console.error('Certificates folder not found:', certDir);
    process.exit(2);
  }
  const certFiles = fs.readdirSync(certDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(certDir, f));
  let allPassed = true;
  for (const file of certFiles) {
    const result = verifyOne(file);
    result.messages.forEach(msg => console.log(msg));
    if (!result.passed) allPassed = false;
  }
  if (allPassed) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main();
