

// config/chronosConfig.js

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
        weekday: ["06:00", "23:00"],
        saturday: ["06:30", "23:00"],
        sunday: ["07:30", "23:00"],
        festive: ["07:30", "23:00"]
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
    },

    // Job Definitions for Period Transitions
    jobs: [
        // Service start/end times
        { name: 'service-start-weekday', schedule: '0 6 * * 1-5', task: 'announcementService.announceServiceStart' },
        { name: 'service-end-weekday', schedule: '0 23 * * 1-5', task: 'announcementService.announceServiceEnd' },
        { name: 'service-start-saturday', schedule: '30 6 * * 6', task: 'announcementService.announceServiceStart' },
        { name: 'service-end-saturday', schedule: '0 23 * * 6', task: 'announcementService.announceServiceEnd' },
        { name: 'service-start-sunday-festive', schedule: '30 7 * * 0,7', task: 'announcementService.announceServiceStart' },
        { name: 'service-end-sunday-festive', schedule: '0 23 * * 0,7', task: 'announcementService.announceServiceEnd' },

        // Fare period transitions (weekday)
        { name: 'fare-period-to-punta-morning', schedule: '0 7 * * 1-5', task: 'announcementService.announceFarePeriodChange' },
        { name: 'fare-period-to-valle-morning', schedule: '0 9 * * 1-5', task: 'announcementService.announceFarePeriodChange' },
        { name: 'fare-period-to-punta-evening', schedule: '0 18 * * 1-5', task: 'announcementService.announceFarePeriodChange' },
        { name: 'fare-period-to-valle-evening', schedule: '0 20 * * 1-5', task: 'announcementService.announceFarePeriodChange' },
        { name: 'fare-period-to-bajo-evening', schedule: '45 20 * * 1-5', task: 'announcementService.announceFarePeriodChange' },

        // Express service transitions (weekday)
        { name: 'express-morning-start', schedule: '0 6 * * 1-5', task: 'statusManager.activateExpressService' },
        { name: 'express-morning-end', schedule: '0 9 * * 1-5', task: 'statusManager.deactivateExpressService' },
        { name: 'express-evening-start', schedule: '0 18 * * 1-5', task: 'statusManager.activateExpressService' },
        { name: 'express-evening-end', schedule: '0 21 * * 1-5', task: 'statusManager.deactivateExpressService' }
    ]
};

module.exports = config;
