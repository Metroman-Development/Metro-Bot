const logger = require('./events/logger');
const initialize = require('./core/bootstrap');
const SchedulerService = require('./core/chronos/SchedulerService');
const timeHelpers = require('./core/chronos/timeHelpers');
const TimeService = require('./core/chronos/TimeService');
const timeHelpers = require('./core/chronos/timeHelpers');
const ApiService = require('./core/metro/core/services/ApiService');
const MetroInfoProvider = require('./utils/MetroInfoProvider');

async function startScheduler() {
    logger.info('[SCHEDULER] Starting scheduler...');
    const { metroCore, db } = await initialize('SCHEDULER');

    const timeService = new TimeService(metroCore);
    const apiService = metroCore._subsystems.api;

    timeService.on('serviceEnd', async () => {
        logger.info('[SCHEDULER] Service has ended. Setting all stations to "Fuera de servicio".');
        await metroCore._subsystems.api.dbService.setAllStationsStatus('Fuera de servicio', 'Cierre por horario');
    });

    const scheduler = new SchedulerService(metroCore, timeService, db);
    const chronosConfig = require('./config/chronosConfig');

    // API fetching job
    scheduler.addJob({
        name: 'api-fetch',
        interval: 60000, // Every minute
        task: async () => {
            await timeService.checkTime();
            if (timeHelpers.isWithinOperatingHours()) {
                const apiData = await apiService.fetchNetworkStatus();
                MetroInfoProvider.updateFromApi(apiData, timeService);
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
            MetroInfoProvider.updateFromDb(dbData, timeService);
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
                const [service, method] = jobConfig.task.split('.');
                if (service === 'timeService' && typeof scheduler.timeService[method] === 'function') {
                    return scheduler.timeService[method]();
                } else {
                    logger.error(`[Scheduler] Task not found: ${jobConfig.task}`);
                }
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
