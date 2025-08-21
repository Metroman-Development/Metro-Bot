const logger = require('./events/logger');
const initialize = require('./core/bootstrap');
const SchedulerService = require('./core/chronos/SchedulerService');
const TimeService = require('./core/chronos/TimeService');

async function startScheduler() {
    logger.info('[SCHEDULER] Starting scheduler...');
    const { metroCore } = await initialize('SCHEDULER');

    const timeService = new TimeService(metroCore);

    timeService.on('serviceEnd', async () => {
        logger.info('[SCHEDULER] Service has ended. Setting all stations to "Fuera de servicio".');
        await metroCore._subsystems.api.dbService.setAllStationsStatus('Fuera de servicio', 'Cierre por horario');
    });

    const scheduler = new SchedulerService(metroCore, timeService);
    const chronosConfig = require('./config/chronosConfig');

    // Combined task for jobs that run every minute
    const everyMinuteTasks = async () => {
        await scheduler.metroCore._subsystems.api.fetchNetworkStatus();
        await scheduler.timeService.checkTime();
        await scheduler.metroCore._subsystems.overrideManager.checkScheduledOverrides();
    };

    scheduler.addJob({
        name: 'every-minute-tasks',
        interval: 60000, // Every minute
        task: everyMinuteTasks
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
            const taskFunction = () => {
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
