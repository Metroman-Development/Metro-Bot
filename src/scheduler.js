require('dotenv').config();
const logger = require('./events/logger');
const MetroCore = require('./core/metro/core/MetroCore');
const SchedulerService = require('./core/chronos/SchedulerService');
const TimeService = require('./core/chronos/TimeService');

async function startScheduler() {
    logger.info('[SCHEDULER] Initializing...');

    const dbConfig = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.METRODB_NAME,
    };

    let metroCore;
    try {
        metroCore = await MetroCore.getInstance({ dbConfig });
        logger.info('[SCHEDULER] MetroCore initialized.');
    } catch (error) {
        logger.error('[SCHEDULER] ❌ Failed to initialize MetroCore:', { error });
        process.exit(1);
    }

    const timeService = new TimeService(metroCore);

    timeService.on('serviceEnd', async () => {
        logger.info('[SCHEDULER] Service has ended. Setting all stations to "Fuera de servicio".');
        await metroCore._subsystems.api.dbService.setAllStationsStatus('Fuera de servicio', 'Cierre por horario');
    });

    const scheduler = new SchedulerService();

    scheduler.addJob({
        name: 'fetch-network-status',
        interval: 60000, // Every minute
        task: () => metroCore._subsystems.api.fetchNetworkStatus()
    });

    scheduler.addJob({
        name: 'check-accessibility',
        interval: 60000, // Every minute
        task: () => metroCore._subsystems.accessibilityService.checkAccessibility()
    });

    scheduler.addJob({
        name: 'check-time',
        interval: 60000, // Every minute
        task: () => timeService.checkTime()
    });

    scheduler.addJob({
        name: 'check-scheduled-overrides',
        interval: 60000, // Every minute
        task: () => metroCore._subsystems.overrideManager.checkScheduledOverrides()
    });

    scheduler.start();
    logger.info('[SCHEDULER] ✅ Scheduler started successfully.');
}

startScheduler();

process.on('SIGINT', () => {
    logger.info('[SCHEDULER] Shutting down...');
    // Add cleanup logic here if needed, e.g., scheduler.stop()
    process.exit(0);
});
