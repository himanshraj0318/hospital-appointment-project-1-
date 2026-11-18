const assert = require('assert');
const http = require('http');
const createApp = require('../src/app');
const { initDb, closeDb } = require('../src/db');
const CONFIG = require('../src/config');

async function runApiTests() {
  console.log('🌐 Starting HTTP REST API Integration Tests...\n');

  // Initialize DB in memory
  await initDb(':memory:');

  const app = createApp();
  const server = http.createServer(app);

  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

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

  // Helper function for fetch
  async function request(path, options = {}) {
    const url = `${baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    return res;
  }

  // 1. Health check & CORS
  await test('GET /api/health returns 200 with CORS headers', async () => {
    const res = await request('/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('access-control-allow-origin'), '*');
    const data = await res.json();
    assert.strictEqual(data.status, 'UP');
  });

  // 2. GET /api/appointments (empty initial state)
  await test('GET /api/appointments initially empty', async () => {
    const res = await request('/api/appointments');
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.total, 0);
    assert.strictEqual(Array.isArray(data.appointments), true);
  });

  // 3. POST /api/appointments/book (Routine)
  await test('POST /api/appointments/book (Routine) allocates slot 9', async () => {
    const res = await request('/api/appointments/book', {
      method: 'POST',
      body: JSON.stringify({ patient: 'Alice Smith', emergency: false })
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.appointment.patient, 'Alice Smith');
    assert.strictEqual(data.appointment.doctor, 'Dr. Rao');
    assert.strictEqual(data.appointment.slot, 9);
    assert.strictEqual(data.bumpedPatient, null);
  });

  // 4. POST /api/appointments/book (Validation failure)
  await test('POST /api/appointments/book rejects empty patient name with 400', async () => {
    const res = await request('/api/appointments/book', {
      method: 'POST',
      body: JSON.stringify({ patient: '', emergency: false })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.includes('Missing required field'));
  });

  // 5. POST /api/appointments/demo (Simulates 10 concurrent requests)
  await test('POST /api/appointments/demo creates concurrent requests with zero double bookings', async () => {
    // Reset first
    await request('/api/appointments/reset', { method: 'POST' });

    const res = await request('/api/appointments/demo', {
      method: 'POST',
      body: JSON.stringify({ count: 10 })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.simulatedCount, 10);
    assert.strictEqual(data.verification.doubleBookingsDetected, 0);
    assert.strictEqual(data.verification.totalCurrentlyBooked, 8);
    assert.strictEqual(data.verification.totalCurrentlyWaitlisted, 2);
  });

  // 6. Emergency Bumping via API
  await test('POST /api/appointments/book with emergency: true bumps Routine patient at slot 12', async () => {
    // At this point, 8 routine appointments occupy all slots 9..12
    const res = await request('/api/appointments/book', {
      method: 'POST',
      body: JSON.stringify({ patient: 'Emergency Patient Eve', emergency: true })
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.appointment.type, 'EMERGENCY');
    assert.strictEqual(data.appointment.slot, 12);
    assert.ok(data.bumpedPatient, 'A routine patient must have been bumped');
  });

  // 7. POST /api/appointments/cancel/:id
  await test('POST /api/appointments/cancel/:id deletes and promotes from waitlist', async () => {
    // Fetch all to find a booked appointment
    const listRes = await request('/api/appointments');
    const listData = await listRes.json();
    const target = listData.booked[0];

    const cancelRes = await request(`/api/appointments/cancel/${target.id}`, {
      method: 'POST'
    });
    assert.strictEqual(cancelRes.status, 200);
    const cancelData = await cancelRes.json();
    assert.strictEqual(cancelData.success, true);
    assert.strictEqual(cancelData.canceledId, target.id);
    assert.ok(Array.isArray(cancelData.promoted));
    assert.strictEqual(cancelData.promoted.length, 1);
  });

  // 8. GET /api/appointments/export
  await test('GET /api/appointments/export returns CSV file download', async () => {
    const res = await request('/api/appointments/export');
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type').includes('text/csv'));
    assert.ok(res.headers.get('content-disposition').includes('attachment; filename='));
    const text = await res.text();
    const lines = text.split('\r\n').filter(Boolean);
    assert.strictEqual(lines[0], 'id,type,patient,doctor,time,status');
  });

  // 9. POST /api/appointments/reset
  await test('POST /api/appointments/reset clears database', async () => {
    const res = await request('/api/appointments/reset', { method: 'POST' });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);

    const checkRes = await request('/api/appointments');
    const checkData = await checkRes.json();
    assert.strictEqual(checkData.total, 0);
  });

  // Close server and DB
  await new Promise(resolve => server.close(resolve));
  await closeDb();

  console.log('\n========================================');
  console.log(`📊 API Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runApiTests().catch(err => {
    console.error('Fatal API test error:', err);
    process.exit(1);
  });
}

module.exports = runApiTests;
