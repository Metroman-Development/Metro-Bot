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
        { name: 'Service Start Weekday', schedule: '0 6 * * 1-5', task: 'statusManager.handleServiceStart' },
        { name: 'Service End Weekday', schedule: '0 23 * * 1-5', task: 'statusManager.handleServiceEnd' },
        { name: 'Service Start Saturday', schedule: '30 6 * * 6', task: 'statusManager.handleServiceStart' },
        { name: 'Service End Saturday', schedule: '0 23 * * 6', task: 'statusManager.handleServiceEnd' },
        { name: 'Service Start Sunday/Festive', schedule: '30 7 * * 0,7', task: 'statusManager.handleServiceStart' },
        { name: 'Service End Sunday/Festive', schedule: '0 23 * * 0,7', task: 'statusManager.handleServiceEnd' },

        // Fare period transitions (weekday)
        { name: 'Fare Period to Valle (Morning Start)', schedule: '0 6 * * 1-5', task: 'statusManager.handleFarePeriodChange', period: 'VALLE' },
        { name: 'Fare Period to Punta (Morning)', schedule: '0 7 * * 1-5', task: 'statusManager.handleFarePeriodChange', period: 'PUNTA' },
        { name: 'Fare Period to Valle (Morning End)', schedule: '0 9 * * 1-5', task: 'statusManager.handleFarePeriodChange', period: 'VALLE' },
        { name: 'Fare Period to Punta (Evening)', schedule: '0 18 * * 1-5', task: 'statusManager.handleFarePeriodChange', period: 'PUNTA' },
        { name: 'Fare Period to Valle (Evening)', schedule: '0 20 * * 1-5', task: 'statusManager.handleFarePeriodChange', period: 'VALLE' },
        { name: 'Fare Period to Bajo (Evening)', schedule: '45 20 * * 1-5', task: 'statusManager.handleFarePeriodChange', period: 'BAJO' },
        { name: 'Fare Period to Noche (End of Service)', schedule: '0 23 * * 1-5', task: 'statusManager.handleFarePeriodChange', period: 'NOCHE' },

        // Express service transitions (weekday)
        { name: 'Express Service Morning Start', schedule: '0 6 * * 1-5', task: 'metroInfoProvider.activateExpressService' },
        { name: 'Express Service Morning End', schedule: '0 9 * * 1-5', task: 'metroInfoProvider.deactivateExpressService' },
        { name: 'Express Service Afternoon Start', schedule: '0 18 * * 1-5', task: 'metroInfoProvider.activateExpressService' },
        { name: 'Express Service Afternoon End', schedule: '0 21 * * 1-5', task: 'metroInfoProvider.deactivateExpressService' }
    ]
};

module.exports = config;
