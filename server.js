const createApp = require('./src/app');
const { initDb, closeDb } = require('./src/db');
const CONFIG = require('./src/config');

async function startServer() {
  try {
    // 1. Initialize SQLite database & unique index
    console.log(`[DB] Initializing SQLite database at: ${CONFIG.DB_PATH}`);
    await initDb();
    console.log('[DB] Database schema and unique index verified.');

    // 2. Create Express app
    const app = createApp();

    // 3. Start HTTP server
    const server = app.listen(CONFIG.PORT, () => {
      console.log('====================================================');
      console.log(`🏥 Clinical Emergency Scheduler Server Active!`);
      console.log(`🌐 Server URL:     http://localhost:${CONFIG.PORT}`);
      console.log(`📋 API Base:       http://localhost:${CONFIG.PORT}/api/appointments`);
      console.log(`🩺 Doctors:        ${CONFIG.DOCTORS.join(', ')}`);
      console.log(`⏰ Slots:          ${CONFIG.SLOTS.map(s => CONFIG.formatSlotTime(s)).join(', ')}`);
      console.log('====================================================');
    });

    // Handle graceful shutdown
    const handleShutdown = async (signal) => {
      console.log(`\n[Server] Received ${signal}. Closing HTTP server...`);
      server.close(async () => {
        console.log('[Server] HTTP server closed.');
        try {
          await closeDb();
          console.log('[DB] SQLite connection closed.');
          process.exit(0);
        } catch (dbErr) {
          console.error('[DB] Error during DB close:', dbErr);
          process.exit(1);
        }
      });
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));

    return { app, server };
  } catch (err) {
    console.error('Failed to start clinical scheduler server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
