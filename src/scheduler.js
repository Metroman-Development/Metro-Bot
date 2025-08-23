const logger = require('./events/logger');
const initialize = require('./core/bootstrap');
const SchedulerService = require('./core/SchedulerService');
const TimeHelpers = require('./utils/timeHelpers');
const ApiService = require('./core/metro/core/services/ApiService');
const MetroInfoProvider = require('./utils/MetroInfoProvider');
const moment = require('moment-timezone');
const AnnouncementService = require('./core/metro/announcers/AnnouncementService');
const chronosConfig = require('./config/chronosConfig');

async function startScheduler() {
    logger.info('[SCHEDULER] Starting scheduler...');
    const { metroCore } = await initialize('SCHEDULER');
    const db = metroCore.dbManager;

    const apiService = metroCore._subsystems.api;
    const dbService = metroCore._subsystems.dbService;
    const announcementService = new AnnouncementService();

    const scheduler = new SchedulerService(metroCore, db);

    // API fetching job
    scheduler.addJob({
        name: 'api-fetch',
        interval: 60000, // Every minute
        task: async () => {
            if (TimeHelpers.isWithinOperatingHours()) {
                const apiData = await apiService.fetchNetworkStatus();
                MetroInfoProvider.updateFromApi(apiData);
            }
        }
    });

    // Check Events job
    scheduler.addJob({
        name: 'check-events',
        interval: 60000, // Every minute
        task: async () => {
            try {
                const result = await db.query('SELECT events FROM system_info WHERE id = ?', [1]);
                let activeEvent = null;
                if (result && result.length > 0 && result[0].events) {
                    const events = JSON.parse(result[0].events);
                    const now = TimeHelpers.currentTime;

                    for (const event of events) {
                        const startTime = moment.tz(event.startTime, chronosConfig.timezone);
                        const endTime = moment.tz(event.endTime, chronosConfig.timezone);

                        if (now.isBetween(startTime, endTime)) {
                            activeEvent = event;
                            break;
                        }
                    }
                }
                await dbService.updateActiveEvent(activeEvent);
            } catch (error) {
                if (error.code !== 'ER_BAD_FIELD_ERROR' && (!error.message || !error.message.includes("Cannot read property 'events' of undefined"))) {
                     logger.error('[SCHEDULER] Error checking for events:', error);
                }
            }
        }
    });

    // Database fetching job
    scheduler.addJob({
        name: 'database-fetch',
        interval: 30000, // Every 30 seconds
        task: async () => {
            // This is a placeholder for the database fetching logic
            const dbData = {
                stations: {
                    // Mock data
                    'L1_SP': { id: 'L1_SP', name: 'San Pablo', line: 'L1', status: 'operational' }
                }
            };
            MetroInfoProvider.updateFromDb(dbData);
            logger.info('[SCHEDULER] Fetching data from database...');
        }
    });

    // Network status calculation job
    scheduler.addJob({
        name: 'network-status-calculation',
        interval: 30000, // Every 30 seconds
        task: async () => {
            setTimeout(async () => {
                const data = MetroInfoProvider.getFullData();
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
                MetroInfoProvider.updateData(data);
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
                    const periodInfo = TimeHelpers.getFarePeriod();

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
