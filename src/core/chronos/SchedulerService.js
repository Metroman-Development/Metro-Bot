const logger = require('../../events/logger');

class SchedulerService {
    constructor() {
        this.jobs = new Map();
        this.running = new Set();
    }

    addJob(job) {
        if (!job.name || !job.interval || !job.task) {
            throw new Error('Job must have a name, interval, and task');
        }
        if (this.jobs.has(job.name)) {
            logger.warn(`[SchedulerService] Job "${job.name}" already exists. It will be overwritten.`);
        }
        this.jobs.set(job.name, { ...job, timer: null });
        logger.info(`[SchedulerService] Job added: ${job.name}`);
    }

    start() {
        logger.info('[SchedulerService] Starting scheduler...');
        this.jobs.forEach(job => this.scheduleNext(job.name));
    }

    scheduleNext(jobName) {
        const job = this.jobs.get(jobName);
        if (!job) return;

        const jobWrapper = async () => {
            if (this.running.has(jobName)) {
                logger.warn(`[SchedulerService] Job "${jobName}" is already running. Skipping this execution.`);
                // We still need to schedule the next run
                if (this.jobs.has(jobName)) {
                    job.timer = setTimeout(() => this.scheduleNext(jobName), job.interval);
                    this.jobs.set(jobName, job);
                }
                return;
            }

            try {
                this.running.add(jobName);
                logger.debug(`[SchedulerService] Running job: ${jobName}`);
                await job.task();
            } catch (error) {
                logger.error(`[SchedulerService] Error in job ${jobName}:`, error);
            } finally {
                this.running.delete(jobName);
                if (this.jobs.has(jobName)) {
                    job.timer = setTimeout(() => this.scheduleNext(jobName), job.interval);
                    this.jobs.set(jobName, job);
                }
            }
        };

        // Start the first execution immediately
        jobWrapper();
    }

    stop() {
        logger.info('[SchedulerService] Stopping scheduler...');
        this.jobs.forEach(job => {
            if (job.timer) {
                clearTimeout(job.timer);
            }
        });
        this.jobs.clear();
        this.running.clear();
    }

    getJob(name) {
        return this.jobs.get(name);
    }
}

module.exports = SchedulerService;
