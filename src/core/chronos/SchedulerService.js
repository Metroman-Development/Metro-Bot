const logger = require('../../events/logger');
const schedule = require('node-schedule');

class SchedulerService {
    constructor(metroCore, timeService) {
        this.metroCore = metroCore;
        this.timeService = timeService;
        this.jobs = new Map();
        this.running = new Set();
    }

    addJob(job) {
        if (!job.name || !(job.interval || job.schedule) || !job.task) {
            throw new Error('Job must have a name, task, and either an interval or schedule.');
        }
        if (this.jobs.has(job.name)) {
            logger.warn(`[SchedulerService] Job "${job.name}" already exists. It will be overwritten.`);
        }
        this.jobs.set(job.name, { ...job, timer: null });
        logger.info(`[SchedulerService] Job added: ${job.name}`);
    }

    start() {
        logger.info('[SchedulerService] Starting scheduler...');
        this.jobs.forEach(job => {
            if (job.schedule) {
                this.scheduleCronJob(job.name);
            } else {
                this.scheduleIntervalJob(job.name);
            }
        });
    }

    scheduleCronJob(jobName) {
        const job = this.jobs.get(jobName);
        if (!job) return;

        const jobWrapper = async () => {
            if (this.running.has(jobName)) {
                logger.warn(`[SchedulerService] Job "${jobName}" is already running. Skipping this execution.`);
                return;
            }
            try {
                this.running.add(jobName);
                logger.info(`[SchedulerService] Starting job: ${jobName}`);
                await job.task();
                logger.info(`[SchedulerService] Finished job: ${jobName}`);
            } catch (error) {
                logger.error(`[SchedulerService] Error in job ${jobName}:`, error);
            } finally {
                this.running.delete(jobName);
            }
        };

        const scheduledJob = schedule.scheduleJob(job.schedule, jobWrapper);
        job.timer = scheduledJob; // Store the scheduled job instance
        this.jobs.set(jobName, job);
    }

    scheduleIntervalJob(jobName) {
        const job = this.jobs.get(jobName);
        if (!job) return;

        const jobWrapper = async () => {
            if (this.running.has(jobName)) {
                logger.warn(`[SchedulerService] Job "${jobName}" is already running. Skipping this execution.`);
                if (this.jobs.has(jobName)) {
                    job.timer = setTimeout(() => this.scheduleIntervalJob(jobName), job.interval);
                    this.jobs.set(jobName, job);
                }
                return;
            }

            try {
                this.running.add(jobName);
                logger.info(`[SchedulerService] Starting job: ${jobName}`);
                await job.task();
                logger.info(`[SchedulerService] Finished job: ${jobName}`);
            } catch (error) {
                logger.error(`[SchedulerService] Error in job ${jobName}:`, error);
            } finally {
                this.running.delete(jobName);
                if (this.jobs.has(jobName)) {
                    job.timer = setTimeout(() => this.scheduleIntervalJob(jobName), job.interval);
                    this.jobs.set(jobName, job);
                }
            }
        };
        jobWrapper();
    }

    stop() {
        logger.info('[SchedulerService] Stopping scheduler...');
        this.jobs.forEach(job => {
            if (job.timer) {
                if (job.schedule) {
                    job.timer.cancel();
                } else {
                    clearTimeout(job.timer);
                }
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
