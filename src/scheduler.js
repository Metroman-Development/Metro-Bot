const logger = require('./events/logger');
const initialize = require('./core/bootstrap');
const SchedulerService = require('./core/SchedulerService');
const timeHelpers = require('./utils/timeHelpers');
const ApiService = require('./core/metro/core/services/ApiService');
const MetroInfoProvider = require('./utils/MetroInfoProvider');
const moment = require('moment-timezone');

async function startScheduler() {
    logger.info('[SCHEDULER] Starting scheduler...');
    const { metroCore, db } = await initialize('SCHEDULER');

    const apiService = metroCore._subsystems.api;
    const dbService = metroCore._subsystems.dbService;
    let lastFarePeriod = null;
    let lastServiceStatus = null;

    const scheduler = new SchedulerService(metroCore, db);
    const chronosConfig = require('./config/chronosConfig');

    // API fetching job
    scheduler.addJob({
        name: 'api-fetch',
        interval: 60000, // Every minute
        task: async () => {
            if (timeHelpers.isWithinOperatingHours()) {
                const apiData = await apiService.fetchNetworkStatus();
                MetroInfoProvider.updateFromApi(apiData);
            }
        }
    });

    // Check Service Status job
    scheduler.addJob({
        name: 'check-service-status',
        interval: 10000, // Every 10 seconds
        task: async () => {
            const isOperating = timeHelpers.isWithinOperatingHours();

            if (lastServiceStatus !== isOperating) {
                if (isOperating) {
                    logger.info('[SCHEDULER] Metro service has started.');
                } else {
                    logger.info('[SCHEDULER] Metro service has ended.');
                    await dbService.setAllStationsStatus('Fuera de servicio', 'Cierre por horario');
                }
                lastServiceStatus = isOperating;
            }
        }
    });

    // Check Fare Period job
    scheduler.addJob({
        name: 'check-fare-period',
        interval: 10000, // Every 10 seconds
        task: async () => {
            const now = timeHelpers.currentTime;
            let currentFarePeriod = 'NOCHE'; // Default when not operating

            if (timeHelpers.isWithinOperatingHours(now)) {
                const dayType = timeHelpers.getDayType(now);

                if (dayType === 'weekday') {
                    currentFarePeriod = 'BAJO'; // Default for weekday operating hours

                    if (chronosConfig.farePeriods.PUNTA.some(p => timeHelpers.isTimeBetween(now, p.start, p.end))) {
                        currentFarePeriod = 'PUNTA';
                    } else if (chronosConfig.farePeriods.VALLE.some(p => timeHelpers.isTimeBetween(now, p.start, p.end))) {
                        currentFarePeriod = 'VALLE';
                    }
                } else {
                    // Saturday, Sunday, Festive
                    currentFarePeriod = 'BAJO';
                }
            }

            if (lastFarePeriod !== currentFarePeriod) {
                logger.info(`[SCHEDULER] Fare period changed from ${lastFarePeriod} to ${currentFarePeriod}`);
                lastFarePeriod = currentFarePeriod;
                await dbService.updateFarePeriod(currentFarePeriod);
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
                    const now = timeHelpers.currentTime;

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
                    timestamp: timeHelpers.currentTime.toISOString()
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
            const taskFunction = async () => {
                await scheduler.checkAndScheduleEvents();
                // The logic to call tasks from chronosConfig has been removed
                // as TimeService is no longer in use.
            };

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
