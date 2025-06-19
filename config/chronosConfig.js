

// config/chronosConfig.js
const logger = require('../events/logger');

const config = {
    // Core Configuration
    timezone: 'America/Santiago',
    locale: 'es',

    // Date Management (aligned with metroConfig.js)
    festiveDays: [
        "2025-01-01", "2025-04-18", "2025-04-19", "2025-05-01",
        "2025-05-21", "2025-06-20", "2025-06-29", "2025-07-16", "2025-08-15",
        "2025-09-18", "2025-09-19", "2025-10-12", "2025-10-31",
        "2025-11-01", "2025-12-08", "2025-12-25"
    ],

    // Schedule Configuration (Unified Structure)
    schedule: {
        // Base schedules (HH:MM format)
        weekday: ["06:00", "23:00"],
        saturday: ["06:30", "23:00"],
        sunday: ["07:30", "23:00"],
        
        // Time periods (HH:MM format)
        peak: [
            { start: "07:00", end: "09:00" },
            { start: "18:00", end: "20:00" }
        ],
        offpeak: [
            { start: "09:00", end: "18:00" },
            { start: "20:00", end: "23:00" }
        ],
        overnight: { start: "00:00", end: "06:00" }
    },

    farePeriods: {
        PUNTA: [
            { start: "07:00", end: "09:00" },  // Morning peak
            { start: "18:00", end: "20:00" }   // Evening peak
        ],
        VALLE: [
            { start: "06:00", end: "07:00"}, //first day period
            { start: "09:00", end: "18:00" },  // Midday
            { start: "20:00", end: "20:45" }    // Late evening
        ],
        BAJO: [
            { start: "20:45", end: "23:00" }],    // Early morning
        NOCHE: [{
            start: "23:00", end: "06:00"
        }],
        // Additional periods from metroConfig.js
        SERVICEHOURS: [
            { start: "06:00:00", end: "23:00:00" },   // Weekdays
            { start: "06:30:00", end: "23:00:00" },   // Saturday
            { start: "07:30:00", end: "23:00:00" }    // Sunday
        ]
    },

    // Service Hours (Enhanced with HH:MM format)
    serviceHours: {
        weekday: { start: "06:00", end: "23:00" },
        saturday: { start: "06:30", end: "23:00" },
        sunday: { start: "07:30", end: "23:00" },
        festive: { start: "07:30", end: "23:00" }
    },

    // Express Service (Aligned with metroConfig.js)
    expressHours: {
        morning: { start: "06:00", end: "09:00" },
        evening: { start: "18:00", end: "21:00" }  // Changed to match metroConfig
    },
    expressLines: ['L2', 'L4', 'L5'],  // Note: metroConfig uses lowercase

    // Event Management (Unchanged)
    eventDefaults: {
        morning: { start: "08:00", end: "12:00" },
        afternoon: { start: "13:00", end: "18:00" },
        evening: { start: "19:00", end: "22:00" }
    },
    eventTimeSlots: {
        morning: { start: "08:00", end: "12:00" },
        afternoon: { start: "13:00", end: "18:00" },
        evening: { start: "19:00", end: "23:00" },
        default: { start: "12:00", end: "20:00" }
    }
};

module.exports = config;
