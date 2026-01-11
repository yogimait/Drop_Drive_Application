    /**
 * Database Service for DropDrive
 * Manages SQLite database for certificate metadata storage
 * 
 * Location: app.getPath("userData") / dropdrive.db
 * Example: C:\Users\<User>\AppData\Roaming\DropDrive\dropdrive.db
 */

const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

let db = null;

        /**
 * Get the database file path in the user data directory
 * This ensures the DB persists across app restarts and updates
 */
function getDatabasePath() {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'dropdrive.db');
}

/**
 * Initialize the database connection and create schema
 * Should be called once on app startup
 */
function initializeDatabase() {
    if (db) {
        console.log('[DB] Database already initialized');
        return db;
    }

    const dbPath = getDatabasePath();
    console.log(`[DB] Initializing database at: ${dbPath}`);

    try {
        db = new Database(dbPath);

        // Enable WAL mode for better performance
        db.pragma('journal_mode = WAL');

        // Create certificates table with forward-compatible schema
        db.exec(`
      CREATE TABLE IF NOT EXISTS certificates (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        wipe_type TEXT NOT NULL,
        status TEXT NOT NULL,
        device_model TEXT,
        device_size TEXT,
        device_type TEXT,
        device_serial TEXT,
        erase_method TEXT,
        json_path TEXT,
        pdf_path TEXT,
        simulated INTEGER DEFAULT 0,
        user_id TEXT
      )
    `);

        console.log('[DB] Database initialized successfully');
        return db;
    } catch (error) {
        console.error('[DB] Failed to initialize database:', error);
        throw error;
    }
}

/**
 * Insert a certificate record into the database
 * This is SYNCHRONOUS as requested - caller should wrap in try/catch
 * 
 * @param {Object} data - Certificate data to insert
 * @param {string} data.id - UUID (same as JSON/PDF filename)
 * @param {string} data.created_at - ISO timestamp
 * @param {string} data.wipe_type - Clear/Purge/Destroy
 * @param {string} data.status - success/simulated/unsupported/failed
 * @param {string} data.device_model - Device model name
 * @param {string} data.device_size - Device capacity
 * @param {string} data.device_type - Device type (SSD/HDD/USB)
 * @param {string} data.device_serial - Device serial number
 * @param {string} data.erase_method - Method used for wiping
 * @param {string} data.json_path - ABSOLUTE path to JSON certificate
 * @param {string} data.pdf_path - ABSOLUTE path to PDF certificate
 * @param {boolean} data.simulated - Whether this was a dry run
 * @param {string} [data.user_id] - Optional user ID for future cloud sync
 */
function insertCertificate(data) {
    if (!db) {
        throw new Error('Database not initialized');
    }

    const stmt = db.prepare(`
    INSERT INTO certificates (
      id, created_at, wipe_type, status, device_model, device_size,
      device_type, device_serial, erase_method, json_path, pdf_path,
      simulated, user_id
    ) VALUES (
      @id, @created_at, @wipe_type, @status, @device_model, @device_size,
      @device_type, @device_serial, @erase_method, @json_path, @pdf_path,
      @simulated, @user_id
    )
  `);

    const result = stmt.run({
        id: data.id,
        created_at: data.created_at,
        wipe_type: data.wipe_type,
        status: data.status,
        device_model: data.device_model || null,
        device_size: data.device_size || null,
        device_type: data.device_type || null,
        device_serial: data.device_serial || null,
        erase_method: data.erase_method || null,
        json_path: data.json_path || null,
        pdf_path: data.pdf_path || null,
        simulated: data.simulated ? 1 : 0,
        user_id: data.user_id || null
    });

    console.log(`[DB] Inserted certificate: ${data.id}`);
    return result;
}

/**
 * Get all certificates sorted by date descending
 * @returns {Array} Array of certificate records
 */
function getAllCertificates() {
    if (!db) {
        throw new Error('Database not initialized');
    }

    const stmt = db.prepare(`
    SELECT * FROM certificates
    ORDER BY created_at DESC
  `);

    return stmt.all();
}

/**
 * Get a single certificate by ID
 * @param {string} id - Certificate UUID
 * @returns {Object|null} Certificate record or null if not found
 */
function getCertificateById(id) {
    if (!db) {
        throw new Error('Database not initialized');
    }

    const stmt = db.prepare('SELECT * FROM certificates WHERE id = ?');
    return stmt.get(id) || null;
}

/**
 * Close the database connection
 * Should be called on app quit
 */
function closeDatabase() {
    if (db) {
        db.close();
        db = null;
        console.log('[DB] Database closed');
    }
}

/**
 * Check if database is initialized
 * @returns {boolean}
 */
function isDatabaseReady() {
    return db !== null;
}

module.exports = {
    initializeDatabase,
    insertCertificate,
    getAllCertificates,
    getCertificateById,
    closeDatabase,
    isDatabaseReady,
    getDatabasePath
};
