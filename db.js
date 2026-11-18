const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const CONFIG = require('./config');

let dbInstance = null;

/**
 * Initializes and returns the SQLite database connection.
 * @param {string} customDbPath - Optional custom path (e.g., ':memory:' for tests)
 * @returns {Promise<sqlite3.Database>}
 */
function initDb(customDbPath = CONFIG.DB_PATH) {
  return new Promise((resolve, reject) => {
    // If not in-memory, ensure data directory exists
    if (customDbPath !== ':memory:') {
      const dir = path.dirname(customDbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    const db = new sqlite3.Database(customDbPath, (err) => {
      if (err) {
        return reject(err);
      }

      // Configure SQLite pragmas and tables sequentially
      db.serialize(() => {
        // Enable WAL mode for high concurrency and busy timeout
        db.run('PRAGMA journal_mode = WAL');
        db.run('PRAGMA busy_timeout = 5000');

        // Create appointment table
        db.run(`
          CREATE TABLE IF NOT EXISTS appointment (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient TEXT NOT NULL,
            type TEXT NOT NULL,
            doctor TEXT,
            slot INTEGER
          )
        `, (createErr) => {
          if (createErr) return reject(createErr);
        });

        // Create Unique Index to prevent double-booking at DB layer
        db.run(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_doctor_slot 
          ON appointment(doctor, slot)
        `, (indexErr) => {
          if (indexErr) return reject(indexErr);
          dbInstance = db;
          resolve(db);
        });
      });
    });
  });
}

/**
 * Returns the active database instance.
 */
function getDb() {
  if (!dbInstance) {
    throw new Error('Database has not been initialized. Call initDb() first.');
  }
  return dbInstance;
}

/**
 * Promisified db.run
 * @param {string} sql 
 * @param {Array} params 
 * @returns {Promise<{ lastID: number, changes: number }>}
 */
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (err) {
      if (err) {
        return reject(err);
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/**
 * Promisified db.get
 * @param {string} sql 
 * @param {Array} params 
 * @returns {Promise<any>}
 */
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row);
    });
  });
}

/**
 * Promisified db.all
 * @param {string} sql 
 * @param {Array} params 
 * @returns {Promise<any[]>}
 */
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows || []);
    });
  });
}

/**
 * Promisified db.exec
 * @param {string} sql 
 * @returns {Promise<void>}
 */
function dbExec(sql) {
  return new Promise((resolve, reject) => {
    getDb().exec(sql, (err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

/**
 * Closes the database connection.
 * @returns {Promise<void>}
 */
function closeDb() {
  return new Promise((resolve, reject) => {
    if (!dbInstance) {
      return resolve();
    }
    dbInstance.close((err) => {
      if (err) {
        return reject(err);
      }
      dbInstance = null;
      resolve();
    });
  });
}

module.exports = {
  initDb,
  getDb,
  dbRun,
  dbGet,
  dbAll,
  dbExec,
  closeDb
};
