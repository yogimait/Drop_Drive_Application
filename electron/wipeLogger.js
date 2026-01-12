// wipeLogger.js - Production logging for audit trail
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Single source of truth for logs directory
const LOGS_DIR = path.join(app.getPath('userData'), 'logs');
const WIPE_LOG_FILE = path.join(LOGS_DIR, 'wipe.log');

// Ensure logs directory exists
function ensureLogsDir() {
    if (!fs.existsSync(LOGS_DIR)) {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
}

// Format log entry with timestamp
function formatLogEntry(level, category, message, data = null) {
    const timestamp = new Date().toISOString();
    const entry = {
        timestamp,
        level,
        category,
        message,
        ...(data && { data })
    };
    return JSON.stringify(entry);
}

// Append to log file
function writeLog(level, category, message, data = null) {
    try {
        ensureLogsDir();
        const entry = formatLogEntry(level, category, message, data) + '\n';
        fs.appendFileSync(WIPE_LOG_FILE, entry, 'utf8');

        // Also log to console for dev visibility
        const consoleMsg = `[${level}][${category}] ${message}`;
        if (level === 'ERROR') {
            console.error(consoleMsg, data || '');
        } else if (level === 'WARN') {
            console.warn(consoleMsg, data || '');
        } else {
            console.log(consoleMsg, data || '');
        }
    } catch (error) {
        console.error('[WipeLogger] Failed to write log:', error);
    }
}

// Public logging functions
const wipeLogger = {
    // Addon load status
    addonLoaded: (addonPath) => {
        writeLog('INFO', 'ADDON', 'Native wipe addon loaded successfully', { addonPath });
    },

    addonFailed: (addonPath, error) => {
        writeLog('ERROR', 'ADDON', 'Native wipe addon failed to load', { addonPath, error });
    },

    // Wipe operation logging
    wipeStarted: (devicePath, wipeType, dryRun, deviceInfo) => {
        writeLog('INFO', 'WIPE', 'Wipe operation started', {
            devicePath,
            wipeType,
            dryRun,
            deviceModel: deviceInfo?.model,
            deviceSerial: deviceInfo?.serial
        });
    },

    wipeProgress: (devicePath, progress, stage) => {
        writeLog('DEBUG', 'WIPE', 'Wipe progress update', { devicePath, progress, stage });
    },

    wipeCompleted: (devicePath, result, durationMs, bytesWritten = null) => {
        writeLog('INFO', 'WIPE', 'Wipe operation completed', {
            devicePath,
            status: result.status,
            methodUsed: result.methodUsed,
            executed: result.executed,
            durationMs,
            bytesWritten
        });
    },

    wipeFailed: (devicePath, error, durationMs) => {
        writeLog('ERROR', 'WIPE', 'Wipe operation failed', {
            devicePath,
            error: error.message || error,
            durationMs
        });
    },

    // Certificate logging
    certificateGenerated: (certificateId, jsonPath, pdfPath) => {
        writeLog('INFO', 'CERTIFICATE', 'Certificate generated successfully', {
            certificateId,
            jsonPath,
            pdfPath
        });
    },

    certificateFailed: (error) => {
        writeLog('ERROR', 'CERTIFICATE', 'Certificate generation failed', {
            error: error.message || error
        });
    },

    // Security logging
    securityWarning: (message, data) => {
        writeLog('WARN', 'SECURITY', message, data);
    },

    // Generic
    info: (category, message, data) => writeLog('INFO', category, message, data),
    warn: (category, message, data) => writeLog('WARN', category, message, data),
    error: (category, message, data) => writeLog('ERROR', category, message, data),

    // Get log file path
    getLogPath: () => WIPE_LOG_FILE,
    getLogsDir: () => LOGS_DIR
};

module.exports = wipeLogger;
