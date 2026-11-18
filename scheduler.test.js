const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { initDb, closeDb, dbRun, dbAll, dbGet } = require('../src/db');
const schedulerService = require('../src/schedulerService');
const CONFIG = require('../src/config');

async function runTestSuite() {
  console.log('🧪 Starting Clinical Emergency Scheduler Comprehensive Test Suite...\n');

  // Use in-memory database for isolated testing
  const testDbPath = ':memory:';
  await initDb(testDbPath);
  console.log('✅ Database initialized in :memory: mode.');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ PASSED: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAILED: ${name}`);
      console.error(err);
      failed++;
    }
  }

  // TEST 1: Table schema & Unique index enforcement
  await test('Table schema and unique index prevent duplicate (doctor, slot)', async () => {
    await schedulerService.resetAppointments();

    // Insert legitimate booking
    await dbRun(
      'INSERT INTO appointment (patient, type, doctor, slot) VALUES (?, ?, ?, ?)',
      ['Test Patient 1', 'ROUTINE', 'Dr. Rao', 9]
    );

    // Attempting duplicate (Dr. Rao, 9) must throw SQLITE_CONSTRAINT
    let caughtConstraint = false;
    try {
      await dbRun(
        'INSERT INTO appointment (patient, type, doctor, slot) VALUES (?, ?, ?, ?)',
        ['Duplicate Patient', 'ROUTINE', 'Dr. Rao', 9]
      );
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed') || err.message.includes('SQLITE_CONSTRAINT')) {
        caughtConstraint = true;
      } else {
        throw err;
      }
    }
    assert.strictEqual(caughtConstraint, true, 'Unique index did not throw on duplicate (doctor, slot)');

    // Multiple waitlist patients (doctor=null, slot=null) MUST be allowed by unique index
    await dbRun(
      'INSERT INTO appointment (patient, type, doctor, slot) VALUES (?, ?, ?, ?)',
      ['Waitlist 1', 'ROUTINE', null, null]
    );
    await dbRun(
      'INSERT INTO appointment (patient, type, doctor, slot) VALUES (?, ?, ?, ?)',
      ['Waitlist 2', 'ROUTINE', null, null]
    );

    const count = await dbGet('SELECT COUNT(*) as cnt FROM appointment');
    assert.strictEqual(count.cnt, 3, 'Expected 3 records in DB');
  });

  // TEST 2: Earliest slot allocation across doctors
  await test('Earliest available slot allocation (9:00 AM to 12:00 PM)', async () => {
    await schedulerService.resetAppointments();

    const p1 = await schedulerService.bookAppointment({ patient: 'Patient A', emergency: false });
    assert.strictEqual(p1.appointment.doctor, 'Dr. Rao');
    assert.strictEqual(p1.appointment.slot, 9);

    const p2 = await schedulerService.bookAppointment({ patient: 'Patient B', emergency: false });
    assert.strictEqual(p2.appointment.doctor, 'Dr. Mehta');
    assert.strictEqual(p2.appointment.slot, 9);

    const p3 = await schedulerService.bookAppointment({ patient: 'Patient C', emergency: false });
    assert.strictEqual(p3.appointment.doctor, 'Dr. Rao');
    assert.strictEqual(p3.appointment.slot, 10);

    const p4 = await schedulerService.bookAppointment({ patient: 'Patient D', emergency: false });
    assert.strictEqual(p4.appointment.doctor, 'Dr. Mehta');
    assert.strictEqual(p4.appointment.slot, 10);
  });

  // TEST 3: Priority Waitlist ordering (Emergency first, then FIFO by id)
  await test('Waitlist orders Emergency (Priority 1) before Routine (Priority 4), then FIFO', async () => {
    await schedulerService.resetAppointments();

    // Fill all 8 slots first
    for (let i = 1; i <= 8; i++) {
      await schedulerService.bookAppointment({ patient: `Booked #${i}`, emergency: false });
    }

    // Now all slots are full. Book Routine #1
    const r1 = await schedulerService.bookAppointment({ patient: 'Routine Waiter 1', emergency: false });
    assert.strictEqual(r1.appointment.doctor, null);
    assert.strictEqual(r1.appointment.status, 'WAITING');

    // Book Routine #2
    const r2 = await schedulerService.bookAppointment({ patient: 'Routine Waiter 2', emergency: false });
    assert.strictEqual(r2.appointment.doctor, null);

    // Book Emergency Waiter (waitlisted if slots were all emergency, but here routine will be bumped.
    // Let's test waitlist ordering directly by inserting directly or retrieving waitlist)
    await dbRun(
      'INSERT INTO appointment (patient, type, doctor, slot) VALUES (?, ?, ?, ?)',
      ['Emergency Waiter 1', 'EMERGENCY', null, null]
    );

    const all = await schedulerService.getAllAppointments();
    // Emergency Waiter 1 must appear at index 0 of waitlist because EMERGENCY = priority 1 < ROUTINE = priority 4
    assert.strictEqual(all.waitlist[0].patient, 'Emergency Waiter 1');
    assert.strictEqual(all.waitlist[0].type, 'EMERGENCY');
    assert.strictEqual(all.waitlist[1].patient, 'Routine Waiter 1');
    assert.strictEqual(all.waitlist[2].patient, 'Routine Waiter 2');
  });

  // TEST 4: Emergency Bumping Logic (bumps Routine patient with LATEST slot hour)
  await test('Emergency booking bumps Routine patient at latest slot hour (12:00 PM)', async () => {
    await schedulerService.resetAppointments();

    // Fill all 8 slots with Routine patients
    for (let i = 1; i <= 8; i++) {
      await schedulerService.bookAppointment({ patient: `Routine Patient ${i}`, emergency: false });
    }

    const stateBefore = await schedulerService.getAllAppointments();
    assert.strictEqual(stateBefore.booked.length, 8);
    assert.strictEqual(stateBefore.waitlist.length, 0);

    // An Emergency booking arrives
    const emergBooking = await schedulerService.bookAppointment({
      patient: 'Critical Trauma Patient',
      emergency: true
    });

    assert.ok(emergBooking.bumpedPatient, 'A routine patient should have been bumped');
    assert.strictEqual(emergBooking.appointment.type, 'EMERGENCY');
    assert.strictEqual(emergBooking.appointment.slot, 12, 'Emergency should take the latest slot hour (12)');
    assert.ok(emergBooking.appointment.doctor === 'Dr. Mehta' || emergBooking.appointment.doctor === 'Dr. Rao');

    // Verify bumped patient is now in waitlist
    const stateAfter = await schedulerService.getAllAppointments();
    assert.strictEqual(stateAfter.booked.length, 8);
    assert.strictEqual(stateAfter.waitlist.length, 1);
    assert.strictEqual(stateAfter.waitlist[0].patient, emergBooking.bumpedPatient);
    assert.strictEqual(stateAfter.waitlist[0].status, 'WAITING');
  });

  // TEST 5: Waitlist promotion on cancellation
  await test('Canceling appointment immediately promotes highest-priority waitlist patient', async () => {
    await schedulerService.resetAppointments();

    // Fill 8 slots
    const bookedPatients = [];
    for (let i = 1; i <= 8; i++) {
      const b = await schedulerService.bookAppointment({ patient: `Initial ${i}`, emergency: false });
      bookedPatients.push(b.appointment);
    }

    // Add Routine waiter and Emergency waiter to waitlist
    const rw = await schedulerService.bookAppointment({ patient: 'Waiting Routine A', emergency: false });
    // Manually add an Emergency to waitlist to verify priority promotion
    const emergWaitResult = await dbRun(
      'INSERT INTO appointment (patient, type, doctor, slot) VALUES (?, ?, ?, ?)',
      ['Waiting Emergency VIP', 'EMERGENCY', null, null]
    );

    // Cancel the very first booked appointment (Dr. Rao, 9:00 AM)
    const canceledId = bookedPatients[0].id;
    const cancelRes = await schedulerService.cancelAppointment(canceledId);

    assert.strictEqual(cancelRes.canceledId, canceledId);
    assert.strictEqual(cancelRes.promoted.length, 1);

    // The promoted patient MUST be the EMERGENCY candidate, NOT the earlier routine candidate!
    const promoted = cancelRes.promoted[0];
    assert.strictEqual(promoted.patient, 'Waiting Emergency VIP');
    assert.strictEqual(promoted.type, 'EMERGENCY');
    assert.strictEqual(promoted.doctor, bookedPatients[0].doctor);
    assert.strictEqual(promoted.slot, bookedPatients[0].slot);

    // Waiting Routine A is still on waitlist
    const currentState = await schedulerService.getAllAppointments();
    assert.strictEqual(currentState.waitlist.length, 1);
    assert.strictEqual(currentState.waitlist[0].patient, 'Waiting Routine A');
  });

  // TEST 6: Concurrency Simulation (10 concurrent requests with Promise.all)
  await test('POST /demo concurrency simulation: 10 concurrent requests without double booking', async () => {
    await schedulerService.resetAppointments();

    const simResult = await schedulerService.simulateConcurrentBookings(10);

    assert.strictEqual(simResult.simulatedCount, 10);
    assert.strictEqual(simResult.verification.doubleBookingsDetected, 0, 'Double bookings were detected!');
    assert.strictEqual(simResult.verification.isDoubleBookingFree, true);
    assert.strictEqual(simResult.verification.totalCurrentlyBooked, 8, 'Expected exactly 8 slots booked');
    assert.strictEqual(simResult.verification.totalCurrentlyWaitlisted, 2, 'Expected 2 on waitlist');

    // Confirm that every booked slot is unique
    const booked = await dbAll('SELECT doctor, slot FROM appointment WHERE doctor IS NOT NULL AND slot IS NOT NULL');
    const set = new Set(booked.map(b => `${b.doctor}_${b.slot}`));
    assert.strictEqual(set.size, 8, 'Booked slot count does not match unique set size');
  });

  // TEST 7: CSV Export Formatting
  await test('Exported CSV has correct headers (id,type,patient,doctor,time,status)', async () => {
    await schedulerService.resetAppointments();
    await schedulerService.bookAppointment({ patient: 'Jane Doe', emergency: false });
    await schedulerService.bookAppointment({ patient: 'John STAT', emergency: true });

    const csv = await schedulerService.exportAppointmentsCsv();
    const lines = csv.split('\r\n').filter(Boolean);

    assert.strictEqual(lines[0], 'id,type,patient,doctor,time,status', 'CSV header mismatch');
    assert.strictEqual(lines.length, 3, 'Expected header + 2 patient rows');
    assert.ok(lines[1].includes('ROUTINE') || lines[1].includes('EMERGENCY'));
  });

  // TEST 8: Reset Endpoint
  await test('Reset clears all appointments from DB', async () => {
    const res = await schedulerService.resetAppointments();
    assert.ok(res.message.includes('reset'));

    const all = await schedulerService.getAllAppointments();
    assert.strictEqual(all.appointments.length, 0);
    assert.strictEqual(all.booked.length, 0);
    assert.strictEqual(all.waitlist.length, 0);
  });

  await closeDb();

  console.log('\n========================================');
  console.log(`📊 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTestSuite().catch(err => {
    console.error('Fatal test execution error:', err);
    process.exit(1);
  });
}

module.exports = runTestSuite;
