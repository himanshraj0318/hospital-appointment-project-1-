const CONFIG = require('./config');
const { dbRun, dbGet, dbAll, dbExec } = require('./db');

/**
 * Lightweight in-memory FIFO Async Mutex to serialize concurrent scheduling operations.
 * Combined with SQLite's UNIQUE index, this provides bulletproof concurrency control.
 */
class AsyncMutex {
  constructor() {
    this._queue = Promise.resolve();
  }

  lock(fn) {
    const next = this._queue.then(() => fn(), () => fn());
    this._queue = next.catch(() => {});
    return next;
  }
}

const schedulerMutex = new AsyncMutex();

/**
 * Returns all possible doctor and slot pairs in chronological order:
 * Slot 9: Dr. Rao, Dr. Mehta
 * Slot 10: Dr. Rao, Dr. Mehta
 * Slot 11: Dr. Rao, Dr. Mehta
 * Slot 12: Dr. Rao, Dr. Mehta
 */
function getAllSlotPairs() {
  const pairs = [];
  for (const slot of CONFIG.SLOTS) {
    for (const doctor of CONFIG.DOCTORS) {
      pairs.push({ doctor, slot });
    }
  }
  return pairs;
}

/**
 * Retrieves all currently available slots in earliest-first order.
 * @returns {Promise<Array<{ doctor: string, slot: number }>>}
 */
async function getAvailableSlots() {
  const booked = await dbAll(
    'SELECT doctor, slot FROM appointment WHERE doctor IS NOT NULL AND slot IS NOT NULL'
  );

  const bookedSet = new Set(booked.map(b => `${b.doctor}_${b.slot}`));
  const allPairs = getAllSlotPairs();

  return allPairs.filter(pair => !bookedSet.has(`${pair.doctor}_${pair.slot}`));
}

/**
 * Retrieves all appointments, returning formatted records along with categorized lists.
 */
async function getAllAppointments() {
  const rows = await dbAll('SELECT * FROM appointment ORDER BY id ASC');

  // Format and annotate each appointment
  const formatted = rows.map(app => {
    const isBooked = app.doctor !== null && app.slot !== null;
    let status;
    if (isBooked) {
      status = app.type === CONFIG.TYPES.EMERGENCY ? 'EMERGENCY' : 'CONFIRMED';
    } else {
      status = 'WAITING';
    }

    return {
      id: app.id,
      patient: app.patient,
      type: app.type,
      doctor: app.doctor || null,
      slot: app.slot !== null ? app.slot : null,
      time: CONFIG.formatSlotTime(app.slot),
      status,
      priority: app.type === CONFIG.TYPES.EMERGENCY ? CONFIG.PRIORITIES.EMERGENCY : CONFIG.PRIORITIES.ROUTINE
    };
  });

  // Booked appointments sorted by earliest slot, then doctor
  const booked = formatted
    .filter(a => a.doctor !== null && a.slot !== null)
    .sort((a, b) => {
      if (a.slot !== b.slot) return a.slot - b.slot;
      return a.doctor.localeCompare(b.doctor);
    });

  // Waitlist sorted by Priority (Emergency = 1 first), then FIFO (id ASC)
  const waitlist = formatted
    .filter(a => a.doctor === null || a.slot === null)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.id - b.id;
    });

  // Compute operational statistics
  const totalEmergency = formatted.filter(a => a.type === CONFIG.TYPES.EMERGENCY).length;
  const totalRoutine = formatted.filter(a => a.type === CONFIG.TYPES.ROUTINE).length;
  const totalBooked = booked.length;
  const totalWaiting = waitlist.length;
  const totalSlots = CONFIG.DOCTORS.length * CONFIG.SLOTS.length;
  const availableSlotsCount = totalSlots - totalBooked;

  return {
    appointments: formatted,
    booked,
    waitlist,
    stats: {
      total: formatted.length,
      totalBooked,
      totalWaiting,
      totalEmergency,
      totalRoutine,
      slotsAvailable: availableSlotsCount,
      slotsTotal: totalSlots,
      doctors: CONFIG.DOCTORS,
      slots: CONFIG.SLOTS
    }
  };
}

/**
 * Core Booking & Bumping Logic.
 * 
 * Rules:
 * 1. Priority: EMERGENCY = 1, ROUTINE = 4.
 * 2. Slot Allocation: Earliest available slot across doctors (9:00 AM to 12:00 PM).
 * 3. Emergency Bumping: If an Emergency booking arrives and all slots are full,
 *    bump the Routine patient holding the LATEST slot hour. Unbook them (set doctor/slot to null),
 *    push them to the waitlist, and assign their slot to the Emergency patient.
 * 4. Routine with all slots full goes to the waitlist.
 * 5. Emergency when all slots are occupied by emergencies goes to waitlist (at highest priority).
 * 
 * @param {{ patient: string, emergency?: boolean|string, type?: string }} payload
 * @returns {Promise<{ appointment: object, bumpedPatient: string|null, message: string }>}
 */
async function bookAppointment({ patient, emergency, type }) {
  if (!patient || typeof patient !== 'string' || patient.trim().length === 0) {
    const error = new Error('Patient name is required and cannot be empty.');
    error.status = 400;
    throw error;
  }

  const patientName = patient.trim();

  // Normalize emergency flag
  let isEmergency = false;
  if (typeof emergency === 'boolean') {
    isEmergency = emergency;
  } else if (typeof emergency === 'string') {
    isEmergency = emergency.toLowerCase() === 'true' || emergency.toLowerCase() === 'emergency';
  } else if (type && typeof type === 'string') {
    isEmergency = type.toUpperCase() === 'EMERGENCY';
  }

  const appType = isEmergency ? CONFIG.TYPES.EMERGENCY : CONFIG.TYPES.ROUTINE;

  return schedulerMutex.lock(async () => {
    const availableSlots = await getAvailableSlots();
    let assignedDoctor = null;
    let assignedSlot = null;
    let bumpedPatientName = null;
    let message = '';

    if (isEmergency) {
      if (availableSlots.length > 0) {
        // Earliest available slot
        const chosen = availableSlots[0];
        assignedDoctor = chosen.doctor;
        assignedSlot = chosen.slot;
        message = `Emergency appointment confirmed for ${patientName} with ${assignedDoctor} at ${CONFIG.formatSlotTime(assignedSlot)}.`;
      } else {
        // All slots are full. Emergency Bumping Logic:
        // Find the booked Routine patient holding the LATEST slot hour.
        const routineToBump = await dbGet(`
          SELECT * FROM appointment
          WHERE type = ? AND doctor IS NOT NULL AND slot IS NOT NULL
          ORDER BY slot DESC, id DESC
          LIMIT 1
        `, [CONFIG.TYPES.ROUTINE]);

        if (routineToBump) {
          bumpedPatientName = routineToBump.patient;
          assignedDoctor = routineToBump.doctor;
          assignedSlot = routineToBump.slot;

          // Unbook Routine patient and push them to waitlist
          await dbRun(
            'UPDATE appointment SET doctor = NULL, slot = NULL WHERE id = ?',
            [routineToBump.id]
          );

          message = `EMERGENCY BUMP: ${patientName} assigned to ${assignedDoctor} at ${CONFIG.formatSlotTime(assignedSlot)}. Routine patient ${bumpedPatientName} was unbooked and pushed to the priority waitlist.`;
        } else {
          // All slots are occupied by EMERGENCY patients! Cannot bump.
          assignedDoctor = null;
          assignedSlot = null;
          message = `All slots are currently occupied by STAT emergency cases. Patient ${patientName} has been queued at the top of the priority waitlist.`;
        }
      }
    } else {
      // Routine Patient
      if (availableSlots.length > 0) {
        const chosen = availableSlots[0];
        assignedDoctor = chosen.doctor;
        assignedSlot = chosen.slot;
        message = `Routine appointment confirmed for ${patientName} with ${assignedDoctor} at ${CONFIG.formatSlotTime(assignedSlot)}.`;
      } else {
        // All slots full, goes to waitlist
        assignedDoctor = null;
        assignedSlot = null;
        message = `All appointment slots are currently booked. Patient ${patientName} added to the waitlist.`;
      }
    }

    // Insert new appointment into DB (unique constraint on doctor, slot enforces no double-booking)
    const result = await dbRun(`
      INSERT INTO appointment (patient, type, doctor, slot)
      VALUES (?, ?, ?, ?)
    `, [patientName, appType, assignedDoctor, assignedSlot]);

    const createdAppointment = {
      id: result.lastID,
      patient: patientName,
      type: appType,
      doctor: assignedDoctor,
      slot: assignedSlot,
      time: CONFIG.formatSlotTime(assignedSlot),
      status: (assignedDoctor && assignedSlot)
        ? (isEmergency ? 'EMERGENCY' : 'CONFIRMED')
        : 'WAITING',
      priority: isEmergency ? CONFIG.PRIORITIES.EMERGENCY : CONFIG.PRIORITIES.ROUTINE
    };

    return {
      appointment: createdAppointment,
      bumpedPatient: bumpedPatientName,
      message
    };
  });
}

/**
 * Cancels an appointment by ID and promotes highest-priority patient from waitlist.
 * 
 * Rules:
 * - Deletes appointment by ID.
 * - When an appointment is canceled, immediately evaluate the waitlist and promote
 *   the highest-priority patient to the freed slot.
 * - Waitlist ordering: Priority (Emergency first), then FIFO (id ASC).
 * 
 * @param {number|string} id 
 * @returns {Promise<{ message: string, canceledId: number, promoted: Array<object> }>}
 */
async function cancelAppointment(id) {
  const numericId = parseInt(id, 10);
  if (isNaN(numericId) || numericId <= 0) {
    const error = new Error('Invalid appointment ID provided.');
    error.status = 400;
    throw error;
  }

  return schedulerMutex.lock(async () => {
    const existing = await dbGet('SELECT * FROM appointment WHERE id = ?', [numericId]);
    if (!existing) {
      const error = new Error(`Appointment with ID ${numericId} not found.`);
      error.status = 404;
      throw error;
    }

    const wasBooked = existing.doctor !== null && existing.slot !== null;

    // Delete appointment
    await dbRun('DELETE FROM appointment WHERE id = ?', [numericId]);

    const promoted = [];

    // If a booked slot was freed, promote candidates from waitlist
    if (wasBooked) {
      // Loop while there are available slots and candidates on waitlist
      while (true) {
        const availableSlots = await getAvailableSlots();
        if (availableSlots.length === 0) break;

        // Highest priority waitlist candidate: EMERGENCY (1) first, then FIFO (id ASC)
        const nextCandidate = await dbGet(`
          SELECT * FROM appointment
          WHERE doctor IS NULL AND slot IS NULL
          ORDER BY CASE WHEN type = ? THEN 1 ELSE 4 END ASC, id ASC
          LIMIT 1
        `, [CONFIG.TYPES.EMERGENCY]);

        if (!nextCandidate) break;

        const slotToAssign = availableSlots[0];

        // Promote candidate into freed slot
        await dbRun(
          'UPDATE appointment SET doctor = ?, slot = ? WHERE id = ?',
          [slotToAssign.doctor, slotToAssign.slot, nextCandidate.id]
        );

        promoted.push({
          id: nextCandidate.id,
          patient: nextCandidate.patient,
          type: nextCandidate.type,
          doctor: slotToAssign.doctor,
          slot: slotToAssign.slot,
          time: CONFIG.formatSlotTime(slotToAssign.slot),
          status: nextCandidate.type === CONFIG.TYPES.EMERGENCY ? 'EMERGENCY' : 'CONFIRMED'
        });
      }
    }

    const message = promoted.length > 0
      ? `Appointment #${numericId} (${existing.patient}) canceled. Promoted ${promoted.map(p => `${p.patient} to ${p.doctor} at ${p.time}`).join(', ')}.`
      : `Appointment #${numericId} (${existing.patient}) canceled. No waitlist promotions were necessary.`;

    return {
      message,
      canceledId: numericId,
      promoted
    };
  });
}

/**
 * Resets all appointments and resets autoincrement sequence.
 */
async function resetAppointments() {
  return schedulerMutex.lock(async () => {
    await dbRun('DELETE FROM appointment');
    try {
      await dbRun("DELETE FROM sqlite_sequence WHERE name = 'appointment'");
    } catch {
      // Ignore if table has never had autoincrement sequence
    }
    return {
      message: 'All appointments have been successfully reset and queue cleared.'
    };
  });
}

/**
 * Exports all appointments as a standard CSV with headers:
 * id,type,patient,doctor,time,status
 * @returns {Promise<string>}
 */
async function exportAppointmentsCsv() {
  const rows = await dbAll(`
    SELECT * FROM appointment 
    ORDER BY 
      CASE WHEN doctor IS NOT NULL THEN 0 ELSE 1 END,
      slot ASC, 
      doctor ASC,
      CASE WHEN type = ? THEN 1 ELSE 4 END ASC,
      id ASC
  `, [CONFIG.TYPES.EMERGENCY]);

  const headers = ['id', 'type', 'patient', 'doctor', 'time', 'status'];
  const lines = [headers.join(',')];

  for (const row of rows) {
    const isBooked = row.doctor !== null && row.slot !== null;
    const timeStr = CONFIG.formatSlotTime(row.slot);
    let statusStr;
    if (isBooked) {
      statusStr = row.type === CONFIG.TYPES.EMERGENCY ? 'EMERGENCY' : 'CONFIRMED';
    } else {
      statusStr = 'WAITING';
    }

    // Escape CSV fields safely
    const cleanPatient = `"${String(row.patient).replace(/"/g, '""')}"`;
    const cleanDoctor = row.doctor ? `"${String(row.doctor).replace(/"/g, '""')}"` : 'Unassigned';

    lines.push([
      row.id,
      row.type,
      cleanPatient,
      cleanDoctor,
      timeStr,
      statusStr
    ].join(','));
  }

  return lines.join('\r\n');
}

/**
 * Simulates 10 concurrent routine booking requests using Promise.all()
 * to prove that no double bookings occur.
 * 
 * @param {number} count 
 * @returns {Promise<object>}
 */
async function simulateConcurrentBookings(count = 10) {
  const patientNames = Array.from({ length: count }, (_, i) => `Concurrent Patient #${i + 1}`);

  // Execute all 10 booking requests concurrently via Promise.all()
  const results = await Promise.all(
    patientNames.map(name => bookAppointment({ patient: name, emergency: false }))
  );

  // Inspect database to verify integrity and absence of double bookings
  const allBooked = await dbAll(
    'SELECT doctor, slot, COUNT(*) as cnt FROM appointment WHERE doctor IS NOT NULL AND slot IS NOT NULL GROUP BY doctor, slot HAVING cnt > 1'
  );

  const totalBookedRows = await dbAll(
    'SELECT * FROM appointment WHERE doctor IS NOT NULL AND slot IS NOT NULL'
  );

  const totalWaitlistRows = await dbAll(
    'SELECT * FROM appointment WHERE doctor IS NULL AND slot IS NULL'
  );

  const doubleBookingsDetected = allBooked.length;

  return {
    simulatedCount: count,
    results: results.map(r => ({
      appointmentId: r.appointment.id,
      patient: r.appointment.patient,
      doctor: r.appointment.doctor,
      slot: r.appointment.slot,
      time: r.appointment.time,
      status: r.appointment.status
    })),
    verification: {
      doubleBookingsDetected,
      totalCurrentlyBooked: totalBookedRows.length,
      totalCurrentlyWaitlisted: totalWaitlistRows.length,
      maxPossibleSlots: CONFIG.DOCTORS.length * CONFIG.SLOTS.length,
      isDoubleBookingFree: doubleBookingsDetected === 0
    }
  };
}

module.exports = {
  getAvailableSlots,
  getAllAppointments,
  bookAppointment,
  cancelAppointment,
  resetAppointments,
  exportAppointmentsCsv,
  simulateConcurrentBookings
};
