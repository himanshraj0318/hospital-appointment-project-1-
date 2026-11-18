const path = require('path');

const CONFIG = {
  PORT: process.env.PORT || 3000,
  DB_PATH: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'scheduler.db'),
  
  // Doctors available in the clinic
  DOCTORS: ['Dr. Rao', 'Dr. Mehta'],
  
  // Available operational appointment slots (hours)
  SLOTS: [9, 10, 11, 12],
  
  // Priority rankings (lower number = higher scheduling priority)
  PRIORITIES: {
    EMERGENCY: 1,
    ROUTINE: 4
  },

  // Types allowed in database
  TYPES: {
    EMERGENCY: 'EMERGENCY',
    ROUTINE: 'ROUTINE'
  },

  // Helper to format slot integer to readable clinical time
  formatSlotTime(slot) {
    if (slot === null || slot === undefined) {
      return 'Waitlist';
    }
    const hour = parseInt(slot, 10);
    if (hour === 12) {
      return '12:00 PM';
    }
    if (hour < 12) {
      return `${String(hour).padStart(2, '0')}:00 AM`;
    }
    return `${String(hour - 12).padStart(2, '0')}:00 PM`;
  }
};

module.exports = CONFIG;
