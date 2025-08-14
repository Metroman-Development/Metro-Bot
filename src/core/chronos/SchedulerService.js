const logger = require('../../events/logger');

class SchedulerService {
    constructor() {
        this.jobs = [];
        this.timers = new Map();
    }

    addJob(job) {
        if (!job.name || !job.interval || !job.task) {
            throw new Error('Job must have a name, interval, and task');
        }
        this.jobs.push(job);
        logger.info(`[SchedulerService] Job added: ${job.name}`);
    }

    start() {
        logger.info('[SchedulerService] Starting scheduler...');
        this.jobs.forEach(job => {
            const timer = setInterval(async () => {
                try {
                    logger.debug(`[SchedulerService] Running job: ${job.name}`);
                    await job.task();
                } catch (error) {
                    logger.error(`[SchedulerService] Error in job ${job.name}:`, error);
                }
            }, job.interval);
            this.timers.set(job.name, timer);
        });
    }

    stop() {
        logger.info('[SchedulerService] Stopping scheduler...');
        this.timers.forEach(timer => clearInterval(timer));
        this.timers.clear();
    }
}

module.exports = SchedulerService;
