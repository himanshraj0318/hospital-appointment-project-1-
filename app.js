const express = require('express');
const cors = require('cors');
const path = require('path');
const appointmentRoutes = require('./routes/appointmentRoutes');

function createApp() {
  const app = express();

  // Enable Cross-Origin Resource Sharing (CORS) for all origins
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));

  // Body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logger for development / debugging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (process.env.NODE_ENV !== 'test') {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
      }
    });
    next();
  });

  // Serve static frontend files from 'public' directory
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Health and System Diagnostics Endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'UP',
      service: 'Clinical Emergency Scheduler Backend',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // Mount API endpoints
  app.use('/api/appointments', appointmentRoutes);

  // Fallback 404 handler for unknown routes
  app.use((req, res, next) => {
    res.status(404).json({
      success: false,
      error: `Endpoint not found: ${req.method} ${req.originalUrl}`
    });
  });

  // Global Error Handler
  app.use((err, req, res, next) => {
    console.error('Unhandled Application Error:', err);
    const statusCode = err.status || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Internal Server Error'
    });
  });

  return app;
}

module.exports = createApp;
