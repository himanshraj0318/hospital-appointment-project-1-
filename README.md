# Clinical Emergency Scheduler • Production REST API & Web Backend

A production-ready Node.js and Express REST API backend built to power a hospital clinical emergency and outpatient appointment scheduling interface. The system implements clinical triage priority queuing, intelligent emergency bumping, automated waitlist promotion upon cancellation, and concurrency protection preventing double-booking at both the application and database layers.

---

## 🏥 System Overview & Core Requirements

| Requirement | Implementation Detail |
|---|---|
| **Runtime & Framework** | Node.js (v20+) with Express |
| **CORS Support** | Enabled across all routes for seamless web browser / cross-origin client access |
| **Database Engine** | SQLite via `sqlite3` driver with WAL mode enabled |
| **Database Schema** | `appointment (id INTEGER PRIMARY KEY AUTOINCREMENT, patient TEXT NOT NULL, type TEXT NOT NULL, doctor TEXT, slot INTEGER)` |
| **Double-Booking Prevention** | `CREATE UNIQUE INDEX idx_appointment_doctor_slot ON appointment(doctor, slot)` |
| **Physicians** | `"Dr. Rao"`, `"Dr. Mehta"` (2 Attending Physicians) |
| **Operating Slots** | `9, 10, 11, 12` (representing 9:00 AM, 10:00 AM, 11:00 AM, 12:00 PM) |
| **Total System Capacity** | 8 concurrent appointment slots (2 doctors × 4 slot hours) |
| **Priority Rules** | `EMERGENCY = 1` (STAT Priority), `ROUTINE = 4` (Outpatient) |

---

## ⚡ Core Business & Scheduling Logic

### 1. Earliest Available Slot Allocation
- Evaluates operational slots in chronological order (`9:00 AM` → `10:00 AM` → `11:00 AM` → `12:00 PM`) across available doctors (`Dr. Rao` followed by `Dr. Mehta`).
- When open slots exist, incoming patients are automatically booked into the earliest available slot.

### 2. Priority-Sorted Waitlist Queue
- Patients who cannot be immediately allocated an open slot are assigned to the unbooked priority waitlist (`doctor = NULL, slot = NULL`).
- Waitlist ranking is strictly evaluated by:
  1. **Priority Tier**: `EMERGENCY` (Priority 1) ahead of `ROUTINE` (Priority 4).
  2. **FIFO Order**: Lower autoincrement `id` first within the same priority level.
- When an Emergency patient is waitlisted (e.g., all 8 slots are already taken by Emergency patients), they immediately jump ahead of all waiting Routine patients.

### 3. STAT Emergency Bumping Logic
- When an Emergency booking arrives and **all 8 slots are full**:
  - The engine searches for the booked Routine patient holding the **LATEST slot hour** (`slot DESC, id DESC`).
  - The Routine patient is unbooked (`doctor = NULL, slot = NULL`) and moved to the priority waitlist.
  - Their freed slot is immediately assigned to the incoming Emergency patient.
  - The API response explicitly returns the created Emergency appointment and the name of the `bumpedPatient`.
- If all 8 slots are already occupied by Emergency cases, no routine bumping is possible; the new Emergency patient is placed at the top of the priority waitlist.

### 4. Automated Waitlist Promotion on Cancellation
- When an appointment is canceled via `POST /api/appointments/cancel/:id`, its record is deleted.
- If the canceled appointment was holding an active slot (`doctor != NULL && slot != NULL`), the freed slot is immediately evaluated against the waitlist.
- The highest-priority waitlist candidate (`EMERGENCY` first, then FIFO by `id`) is promoted into the freed slot.
- The promoted patient's details are returned in the response `promoted: [...]`.

### 5. Concurrency & Race Condition Defense
- **Application Level**: Lightweight asynchronous FIFO mutex (`AsyncMutex`) queues scheduling operations so each booking evaluates up-to-the-millisecond database state.
- **Database Level**: SQLite `UNIQUE INDEX (doctor, slot)` ensures that even if concurrent requests bypass application logic, duplicate assignments fail immediately with `SQLITE_CONSTRAINT`.

---

## 📁 Project Structure

```
clinical-scheduler/
├── server.js                          # Server entry point (starts Express & SQLite)
├── package.json                       # Dependencies (express, cors, sqlite3) & scripts
├── src/
│   ├── app.js                         # Express app setup, CORS, JSON parser, routes, error handlers
│   ├── config.js                      # System constants (doctors, slots, priorities, DB path)
│   ├── db.js                          # SQLite database connection, PRAGMA WAL, schema & unique index
│   ├── schedulerService.js            # Core scheduling engine (bumping, promotion, concurrency demo)
│   └── routes/
│       └── appointmentRoutes.js       # REST API endpoints (/api/appointments/*)
├── public/                            # Static frontend assets served by Express
│   ├── index.html                     # Live Stitch-generated UI wired with backend REST API
│   ├── DESIGN.md                      # Clinical design specifications & token documentation
│   └── screen.png                     # Design preview screenshot
├── test/
│   ├── scheduler.test.js              # Unit tests for scheduling algorithms & DB constraints
│   └── api.test.js                    # Integration tests for all HTTP REST API endpoints
└── data/
    └── scheduler.db                   # SQLite persistent database file (auto-created)
```

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Comprehensive Test Suite
```bash
npm test
```
Runs both the algorithmic test suite (8 tests) and the REST API integration test suite (9 tests).

### 3. Start the Server
```bash
npm start
```
The server will start at:
- **Web UI & Dashboard**: [http://localhost:3000](http://localhost:3000)
- **REST API Base**: [http://localhost:3000/api/appointments](http://localhost:3000/api/appointments)
- **Health Check**: [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

## 📡 REST API Reference

### 1. Retrieve All Appointments
- **Endpoint**: `GET /api/appointments`
- **Description**: Returns all appointments (both booked and waiting), categorized breakdowns, and operational metrics.
- **Response `200 OK`**:
```json
{
  "success": true,
  "total": 3,
  "stats": {
    "total": 3,
    "totalBooked": 2,
    "totalWaiting": 1,
    "totalEmergency": 1,
    "totalRoutine": 2,
    "slotsAvailable": 6,
    "slotsTotal": 8,
    "doctors": ["Dr. Rao", "Dr. Mehta"],
    "slots": [9, 10, 11, 12]
  },
  "appointments": [ ... ],
  "booked": [ ... ],
  "waitlist": [ ... ]
}
```

---

### 2. Book an Appointment
- **Endpoint**: `POST /api/appointments/book`
- **Description**: Books a routine or emergency appointment. Executes bumping if all slots are full and an emergency booking arrives.
- **Request Body**:
```json
{
  "patient": "Eleanor Rigby",
  "emergency": false
}
```
- **Response `201 Created` (Normal Booking)**:
```json
{
  "success": true,
  "message": "Routine appointment confirmed for Eleanor Rigby with Dr. Rao at 09:00 AM.",
  "appointment": {
    "id": 1,
    "patient": "Eleanor Rigby",
    "type": "ROUTINE",
    "doctor": "Dr. Rao",
    "slot": 9,
    "time": "09:00 AM",
    "status": "CONFIRMED",
    "priority": 4
  },
  "bumpedPatient": null
}
```
- **Response `201 Created` (Emergency Bumping Occurred)**:
```json
{
  "success": true,
  "message": "EMERGENCY BUMP: Sarah Connor assigned to Dr. Mehta at 12:00 PM. Routine patient John Doe was unbooked and pushed to the priority waitlist.",
  "appointment": {
    "id": 9,
    "patient": "Sarah Connor",
    "type": "EMERGENCY",
    "doctor": "Dr. Mehta",
    "slot": 12,
    "time": "12:00 PM",
    "status": "EMERGENCY",
    "priority": 1
  },
  "bumpedPatient": "John Doe"
}
```

---

### 3. Cancel Appointment & Trigger Waitlist Promotion
- **Endpoint**: `POST /api/appointments/cancel/:id`
- **Description**: Deletes the specified appointment by ID. If the appointment held a booked slot, the engine immediately evaluates the waitlist and promotes the highest-priority patient to the freed slot.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Appointment #1 (Eleanor Rigby) canceled. Promoted Waiting Patient to Dr. Rao at 09:00 AM.",
  "canceledId": 1,
  "promoted": [
    {
      "id": 10,
      "patient": "Waiting Patient",
      "type": "ROUTINE",
      "doctor": "Dr. Rao",
      "slot": 9,
      "time": "09:00 AM",
      "status": "CONFIRMED"
    }
  ]
}
```

---

### 4. Reset All Appointments
- **Endpoint**: `POST /api/appointments/reset`
- **Description**: Clears all records from the database and resets the autoincrement primary key counter.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "All appointments have been successfully reset and queue cleared."
}
```

---

### 5. Export Appointments as CSV
- **Endpoint**: `GET /api/appointments/export`
- **Description**: Streams a downloadable CSV file formatted with headers:
  `id,type,patient,doctor,time,status`
- **Response Headers**:
  - `Content-Type: text/csv; charset=utf-8`
  - `Content-Disposition: attachment; filename="clinical_appointments_YYYY-MM-DD.csv"`
- **Sample Output**:
```csv
id,type,patient,doctor,time,status
1,ROUTINE,"Eleanor Rigby","Dr. Rao",09:00 AM,CONFIRMED
2,EMERGENCY,"Sarah Connor","Dr. Mehta",12:00 PM,EMERGENCY
3,ROUTINE,"John Doe",Unassigned,Waitlist,WAITING
```

---

### 6. Concurrency Demo (10 Concurrent Requests)
- **Endpoint**: `POST /api/appointments/demo`
- **Description**: Simulates 10 concurrent routine booking requests using `Promise.all()` to mathematically verify that exactly 8 slots are allocated, 2 patients are placed on the waitlist, and **zero double bookings occur**.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Concurrency test completed successfully.",
  "simulatedCount": 10,
  "results": [ ... ],
  "verification": {
    "doubleBookingsDetected": 0,
    "totalCurrentlyBooked": 8,
    "totalCurrentlyWaitlisted": 2,
    "maxPossibleSlots": 8,
    "isDoubleBookingFree": true
  }
}
```

---

## 🧪 Terminal cURL Testing Examples

```bash
# 1. Reset Database
curl -X POST http://localhost:3000/api/appointments/reset

# 2. Book Routine Appointment
curl -X POST http://localhost:3000/api/appointments/book \
  -H "Content-Type: application/json" \
  -d '{"patient": "Alice Smith", "emergency": false}'

# 3. Book Emergency Appointment
curl -X POST http://localhost:3000/api/appointments/book \
  -H "Content-Type: application/json" \
  -d '{"patient": "Bob Trauma", "emergency": true}'

# 4. Trigger 10-Thread Concurrency Simulation
curl -X POST http://localhost:3000/api/appointments/demo

# 5. Cancel Appointment #1
curl -X POST http://localhost:3000/api/appointments/cancel/1

# 6. Download CSV Export
curl -O http://localhost:3000/api/appointments/export
```
#   h o s p i t a l - a p p o i n t m e n t - p r o j e c t - 1 -  
 