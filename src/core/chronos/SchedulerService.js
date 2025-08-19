const logger = require('../../events/logger');

class SchedulerService {
    constructor() {
        this.jobs = new Map();
        this.timers = new Map();
    }

    addJob(job) {
        if (!job.name || !job.interval || !job.task) {
            throw new Error('Job must have a name, interval, and task');
        }
        this.jobs.set(job.name, job);
        logger.info(`[SchedulerService] Job added: ${job.name}`);
    }

    start() {
        logger.info('[SchedulerService] Starting scheduler...');
        this.jobs.forEach(job => this.scheduleJob(job.name));
    }

    async runJob(jobName) {
        const job = this.jobs.get(jobName);
        if (job) {
            try {
                logger.debug(`[SchedulerService] Running job: ${job.name}`);
                await job.task();
            } catch (error) {
                logger.error(`[SchedulerService] Error in job ${job.name}:`, error);
            } finally {
                this.scheduleJob(jobName);
            }
        }
    }

    scheduleJob(jobName) {
        const job = this.jobs.get(jobName);
        if (job) {
            const timer = setTimeout(() => this.runJob(jobName), job.interval);
            this.timers.set(jobName, timer);
        }
    }

    stop() {
        logger.info('[SchedulerService] Stopping scheduler...');
        this.timers.forEach(timer => clearTimeout(timer));
        this.timers.clear();
    }
}

module.exports = SchedulerService;
