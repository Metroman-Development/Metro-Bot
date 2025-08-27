const logger = require('./events/logger');
const bootstrap = require('./core/bootstrap');
const SchedulerService = require('./core/SchedulerService');
const TimeHelpers = require('./utils/timeHelpers');
const MetroInfoProvider = require('./utils/MetroInfoProvider');
const moment = require('moment-timezone');
const AnnouncementService = require('./core/metro/announcers/AnnouncementService');
const StatusManager = require('./core/status/StatusManager');
const chronosConfig = require('./config/chronosConfig');

async function startScheduler() {
    logger.info('[SCHEDULER] Starting scheduler...');
    const { metroCore, databaseManager } = await bootstrap.initialize('SCHEDULER');
    const db = databaseManager;

    const apiService = metroCore._subsystems.api;
    const dbService = metroCore._subsystems.dbService;
    const announcementService = new AnnouncementService();
    const statusManager = new StatusManager(db);
    const metroInfoProvider = MetroInfoProvider.getInstance();

    const scheduler = new SchedulerService(metroCore, db);

    // API fetching job
    scheduler.addJob({
        name: 'api-fetch',
        interval: 60000, // Every minute
        task: async () => {
            const statusService = metroCore._subsystems.statusService;
            if (TimeHelpers.isWithinOperatingHours()) {
                await apiService.fetchNetworkStatus();
            } else {
                await statusService.setSystemToOutOfService();
            }
        }
    });

    // Check Events job
    scheduler.addJob({
        name: 'check-events',
        interval: 60000, // Every minute
        task: async () => {
            await scheduler.checkAndScheduleEvents();
        }
    });

    // Database fetching job
    scheduler.addJob({
        name: 'database-fetch',
        interval: 30000, // Every 30 seconds
        task: async () => {
            logger.info('[SCHEDULER] Fetching data from database...');
            const dbData = await apiService.getDbRawData();
            metroInfoProvider.updateFromDb(dbData);
        }
    });

    // Network status calculation job
    scheduler.addJob({
        name: 'network-status-calculation',
        interval: 30000, // Every 30 seconds
        task: async () => {
            setTimeout(async () => {
                const data = metroInfoProvider.getFullData();
                if (!data || !data.lines) return;
                const lineStatus = data.lines;
                let operationalLines = 0;
                let totalLines = 0;
                for (const lineId in lineStatus) {
                    const line = lineStatus[lineId];
                    if (line.status_type_id === 10) {
                        operationalLines++;
                    }
                    totalLines++;
                }

                let networkStatus = 'operational';
                if (operationalLines === 0) {
                    networkStatus = 'suspended';
                } else if (operationalLines < totalLines) {
                    networkStatus = 'partial';
                }

                data.network_status = {
                    status: networkStatus,
                    timestamp: TimeHelpers.currentTime.toISOString()
                };
                metroInfoProvider.updateData(data);
                logger.info('[SCHEDULER] Calculating network status...');
            }, 2000); // 2-second delay
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

            if (service === 'announcementService') {
                taskFunction = async () => {
                    logger.info(`[SCHEDULER] Running job: ${jobConfig.name}`);
                    const operatingHours = TimeHelpers.getOperatingHours();
                    const periodInfo = TimeHelpers.getCurrentPeriod();

                    switch (method) {
                        case 'announceServiceStart':
                            await announcementService.announceServiceTransition('start', operatingHours);
                            break;
                        case 'announceServiceEnd':
                            await announcementService.announceServiceTransition('end', operatingHours);
                            break;
                        case 'announceFarePeriodChange':
                            await announcementService.announceFarePeriodChange(periodInfo.type, periodInfo);
                            break;
                    }
                };
            } else if (service === 'statusManager') {
                taskFunction = async () => {
                    logger.info(`[SCHEDULER] Running job: ${jobConfig.name}`);
                    switch (method) {
                        case 'activateExpressService':
                            await statusManager.activateExpressService();
                            break;
                        case 'deactivateExpressService':
                            await statusManager.deactivateExpressService();
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

startScheduler();

process.on('SIGINT', () => {
    logger.info('[SCHEDULER] Shutting down...');
    // Add cleanup logic here if needed, e.g., scheduler.stop()
    logger.info('[SCHEDULER] ✅ Scheduler shut down successfully.');
    process.exit(0);
});
