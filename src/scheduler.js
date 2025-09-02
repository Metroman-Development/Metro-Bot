console.log('Scheduler process started');
const logger = require('./events/logger');
const bootstrap = require('./core/bootstrap');
const SchedulerService = require('./core/SchedulerService');
const TimeHelpers = require('./utils/timeHelpers');
const MetroInfoProvider = require('./utils/MetroInfoProvider');
const moment = require('moment-timezone');
const AnnouncementService = require('./core/metro/announcers/AnnouncementService');
const StatusManager = require('./core/status/StatusManager');
const StatusEmbedManager = require('./core/status/StatusEmbedManager');
const chronosConfig = require('./config/chronosConfig');
const metroConfig = require('./config/metro/metroConfig');

let statusManager;

async function startScheduler() {
    logger.info('[SCHEDULER] Starting scheduler...');
    const { metroInfoProvider, databaseManager } = await bootstrap.initialize('SCHEDULER');
    const db = databaseManager;

    const announcementService = new AnnouncementService();

    const statusEmbedManager = new StatusEmbedManager();
    const lineMessageIds = { ...metroConfig.embedMessageIds };
    delete lineMessageIds.overview;

    await statusEmbedManager.initialize(
        metroConfig.embedsChannelId,
        metroConfig.embedMessageIds.overview,
        lineMessageIds
    );

    const DataManager = require('./core/metro/core/services/DataManager');
    const DatabaseService = require('./core/database/DatabaseService');
    const dbService = await DatabaseService.getInstance(db);
    const dataManager = new DataManager({ dbService: dbService });
    statusManager = new StatusManager(db, dataManager, announcementService, statusEmbedManager);

    const scheduler = new SchedulerService(db, dataManager, announcementService, statusEmbedManager, metroInfoProvider, chronosConfig.timezone);

    const { updatePresence } = require('../modules/presence/presence.js');
    const { getClient } = require('../utils/clientManager');
    // Check Events job
    scheduler.addJob({
        name: 'check-events',
        interval: 60000, // Every minute
        task: async () => {
            await scheduler.checkAndScheduleEvents();
            try {
                const client = getClient();
                if (client && client.isReady()) {
                    await updatePresence(client, metroInfoProvider);
                }
            } catch (error) {
                logger.warn('[SCHEDULER] Discord client not ready, skipping presence update.');
            }
        }
    });

    // The change detection and network status calculation job is now handled by the DataManager.
    // The DataManager will be started by the main application process.

    // Load jobs from chronosConfig
    if (chronosConfig.jobs && Array.isArray(chronosConfig.jobs)) {
        chronosConfig.jobs.forEach(jobConfig => {
            const [service, method] = jobConfig.task.split('.');
            let taskFunction;

            if (service === 'statusManager') {
                taskFunction = async () => {
                    logger.info(`[SCHEDULER] Running job: ${jobConfig.name}`);
                    const operatingHours = TimeHelpers.getOperatingHours();
                    const periodInfo = jobConfig.period ? { type: jobConfig.period } : TimeHelpers.getCurrentPeriod();

                    switch (method) {
                        case 'handleServiceStart':
                            await statusManager.handleServiceStart(operatingHours);
                            break;
                        case 'handleServiceEnd':
                            await statusManager.handleServiceEnd(operatingHours);
                            break;
                        case 'handleFarePeriodChange':
                            await statusManager.handleFarePeriodChange(periodInfo);
                            break;
                    }
                };
            } else if (service === 'dataManager') {
                taskFunction = async () => {
                    logger.info(`[SCHEDULER] Running job: ${jobConfig.name}`);
                    switch (method) {
                        case 'activateExpressService':
                            await dataManager.activateExpressService();
                            break;
                        case 'deactivateExpressService':
                            await dataManager.deactivateExpressService();
                            break;
                    }
                };
            } else {
                taskFunction = async () => {
                    await scheduler.checkAndScheduleEvents();
                };
            }

            scheduler.addJob({
                name: jobConfig.name,
                schedule: jobConfig.schedule,
                task: taskFunction
            });
        });
    }

    scheduler.start();
    logger.info('[SCHEDULER] ✅ Scheduler started successfully.');
}

if (require.main === module) {
    startScheduler();
}


process.on('SIGINT', () => {
    logger.info('[SCHEDULER] Shutting down...');
    // Add cleanup logic here if needed, e.g., scheduler.stop()
    logger.info('[SCHEDULER] ✅ Scheduler shut down successfully.');
    process.exit(0);
});

module.exports = {
    startScheduler,
    getStatusManager: () => statusManager
};
