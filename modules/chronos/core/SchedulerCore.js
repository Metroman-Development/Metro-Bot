const schedule = require('node-schedule');
const moment = require('moment-timezone');

class SchedulerCore {
    constructor(timezone = 'America/Santiago') {
        this.timezone = timezone;
        this.activeJobs = new Map();
        this.scheduledEvents = [];
    }

    scheduleJob(name, config, callback) {
        try {
            const rule = new schedule.RecurrenceRule();
            Object.assign(rule, config);
            
            const job = schedule.scheduleJob(rule, async () => {
                try {
                    await callback();
                } catch (error) {
                    console.error(`Job ${name} failed:`, error);
                }
            });
            
            this._trackJob(name, job, config);
            return job;
        } catch (error) {
            console.error(`Error scheduling ${name}:`, error);
            return null;
        }
    }

    _trackJob(name, job, meta) {
        const nextInvocation = job?.nextInvocation?.();
        this.activeJobs.set(name, {
            instance: job,
            meta: {
                ...meta,
                nextRun: nextInvocation ? moment(nextInvocation).tz(this.timezone) : null,
                lastRun: null,
                executionCount: 0
            }
        });
        
        this.scheduledEvents.push({
            jobName: name,
            scheduledTime: nextInvocation,
            status: 'pending'
        });
    }

    cancelJob(name) {
        const jobData = this.activeJobs.get(name);
        if (!jobData) return false;

        try {
            schedule.cancelJob(jobData.instance);
            this.activeJobs.delete(name);
            this.scheduledEvents = this.scheduledEvents.filter(e => e.jobName !== name);
            return true;
        } catch (error) {
            console.error(`Error canceling ${name}:`, error);
            return false;
        }
    }

    getJobSchedule(name) {
        const job = this.activeJobs.get(name);
        if (!job) return null;

        return {
            nextRun: job.meta.nextRun?.format('LLLL'),
            recurrence: job.meta,
            executions: job.meta.executionCount
        };
    }

    listAllJobs() {
        return Array.from(this.activeJobs.entries()).map(([name, data]) => ({
            name,
            nextRun: data.meta.nextRun?.format('LLLL'),
            config: data.meta
        }));
    }
}

module.exports = SchedulerCore;