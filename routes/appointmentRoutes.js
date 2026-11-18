const express = require('express');
const router = express.Router();
const schedulerService = require('../schedulerService');

/**
 * GET /api/appointments
 * Returns all appointments (booked + waiting) with categorized lists and operational statistics.
 */
router.get('/', async (req, res, next) => {
  try {
    const data = await schedulerService.getAllAppointments();
    res.json({
      success: true,
      total: data.stats.total,
      stats: data.stats,
      appointments: data.appointments,
      booked: data.booked,
      waitlist: data.waitlist
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/appointments/book
 * Payload: { patient: string, emergency: boolean }
 * Performs booking/bumping logic.
 * Returns created appointment & bumped patient name (if any).
 */
router.post('/book', async (req, res, next) => {
  try {
    const { patient, emergency, type } = req.body || {};
    
    if (!patient || typeof patient !== 'string' || patient.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: patient (must be a non-empty string).'
      });
    }

    const result = await schedulerService.bookAppointment({
      patient,
      emergency,
      type
    });

    res.status(201).json({
      success: true,
      message: result.message,
      appointment: result.appointment,
      bumpedPatient: result.bumpedPatient
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/appointments/cancel/:id
 * Deletes appointment by ID and promotes highest waitlist candidate.
 * Returns promoted list.
 */
router.post('/cancel/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const result = await schedulerService.cancelAppointment(id);

    res.json({
      success: true,
      message: result.message,
      canceledId: result.canceledId,
      promoted: result.promoted
    });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({
        success: false,
        error: err.message
      });
    }
    if (err.status === 400) {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    next(err);
  }
});

/**
 * POST /api/appointments/reset
 * Clears all appointments from DB.
 */
router.post('/reset', async (req, res, next) => {
  try {
    const result = await schedulerService.resetAppointments();
    res.json({
      success: true,
      message: result.message
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/appointments/export
 * Returns downloadable CSV file formatted with headers: id,type,patient,doctor,time,status
 */
router.get('/export', async (req, res, next) => {
  try {
    const csvContent = await schedulerService.exportAppointmentsCsv();
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `clinical_appointments_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/appointments/demo
 * Simulates 10 concurrent routine booking requests using Promise.all()
 * to prove no double bookings occur.
 */
router.post('/demo', async (req, res, next) => {
  try {
    const count = parseInt(req.body?.count, 10) || 10;
    const result = await schedulerService.simulateConcurrentBookings(count);

    res.json({
      success: true,
      message: 'Concurrency test completed successfully.',
      ...result
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
