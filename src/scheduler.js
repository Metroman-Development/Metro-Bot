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
    const { metroCore, databaseManager } = await bootstrap.initialize('SCHEDULER');
    const db = databaseManager;

    const apiService = metroCore._subsystems.api;
    const dbService = metroCore._subsystems.dbService;
    const announcementService = new AnnouncementService();

    const statusEmbedManager = new StatusEmbedManager(metroCore.client);
    const lineMessageIds = { ...metroConfig.embedMessageIds };
    delete lineMessageIds.overview;

    await statusEmbedManager.initialize(
        metroConfig.embedsChannelId,
        metroConfig.embedMessageIds.overview,
        lineMessageIds
    );

    statusManager = new StatusManager(db, apiService, announcementService, statusEmbedManager);

    const metroInfoProvider = MetroInfoProvider.initialize(metroCore, databaseManager, statusEmbedManager);
    metroCore.metroInfoProvider = metroInfoProvider;

    const scheduler = new SchedulerService(metroCore, db, announcementService, statusEmbedManager, metroInfoProvider, chronosConfig.timezone);

    // Check Events job
    scheduler.addJob({
        name: 'check-events',
        interval: 60000, // Every minute
        task: async () => {
            await scheduler.checkAndScheduleEvents();
        }
    });

    // Change detection and network status calculation job
    scheduler.addJob({
        name: 'change-detection-and-status-calculation',
        interval: 30000, // Every 30 seconds
        task: async () => {
            const { stationChanges, lineChanges } = await dbService.getUnprocessedChanges();

            if (stationChanges.length > 0 || lineChanges.length > 0) {
                logger.info(`[SCHEDULER] Found ${stationChanges.length} unprocessed station changes and ${lineChanges.length} unprocessed line changes.`);

                // In the next step, MetroInfoProvider will be updated to handle these changes.
                // For now, we assume it has a method to apply these changes.
                // await metroInfoProvider.applyChanges({ stationChanges, lineChanges });

                const stationChangeIds = stationChanges.map(c => c.history_id);
                const lineChangeIds = lineChanges.map(c => c.history_id);
                await dbService.markChangesAsProcessed({ stationChangeIds, lineChangeIds });

                // After applying changes, we need to get the updated data for network status calculation.
                // This will also be handled in the next step.
            }

            // The rest of the logic for network status calculation will be here.
            // It will use the updated data from metroInfoProvider.
            // For now, we can't do much until MetroInfoProvider is updated.
            // We can assume that the provider's data is up-to-date for the calculation.

            const data = metroInfoProvider.getFullData();
            if (!data || !data.lines) {
                logger.warn('[SCHEDULER] No data available from MetroInfoProvider for network status calculation.');
                return;
            };

            const lineStatus = data.lines;
            let operationalLines = 0;
            let totalLines = Object.keys(lineStatus).length;

            for (const lineId in lineStatus) {
                if (lineStatus[lineId].status_type_id === 10) { // Assuming 10 is operational
                    operationalLines++;
                }
            }

            let networkStatus = 'operational';
            if (totalLines > 0) {
                if (operationalLines === 0) {
                    networkStatus = 'suspended';
                } else if (operationalLines < totalLines) {
                    networkStatus = 'partial';
                }
            } else {
                networkStatus = 'unknown';
            }

            // This part updates the network_status in the provider.
            // It seems MetroInfoProvider needs an `updateData` method.
            if (!data.network_status) data.network_status = {};
            data.network_status.status = networkStatus;
            data.network_status.timestamp = new Date().toISOString();

            // await metroInfoProvider.updateData(data);
            logger.info(`[SCHEDULER] Network status calculated: ${networkStatus}`);
        }
    });

    scheduler.addJob({
        name: 'check-accessibility',
        interval: 300000, // Every 5 minutes
        task: () => scheduler.metroCore._subsystems.accessibilityService.checkAccessibility()
    });

    scheduler.addJob({
        name: 'send-system-status-report',
        interval: 3600000, // Every hour
        task: () => scheduler.metroCore.sendSystemStatusReport()
    });

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
            } else if (service === 'apiService') {
                taskFunction = async () => {
                    logger.info(`[SCHEDULER] Running job: ${jobConfig.name}`);
                    switch (method) {
                        case 'activateExpressService':
                            await apiService.activateExpressService();
                            break;
                        case 'deactivateExpressService':
                            await apiService.deactivateExpressService();
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
