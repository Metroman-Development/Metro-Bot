const logger = require('../events/logger');
const schedule = require('node-schedule');
const chronosConfig = require('../config/chronosConfig');

class SchedulerService {
    constructor(metroCore, db) {
        this.metroCore = metroCore;
        this.db = db;
        this.jobs = new Map();
        this.running = new Set();
    }

    async checkAndScheduleEvents() {
        const events = await this.db.query('SELECT * FROM special_events WHERE processed = 0');
        for (const event of events) {
            // Schedule job to start the event
            const startJobName = `event-start-${event.event_id}`;
            this.addJob({
                name: startJobName,
                schedule: new Date(event.start_time),
                task: async () => {
                    await this.db.query('UPDATE special_events SET is_active = 1 WHERE event_id = ?', [event.event_id]);
                    const inStations = JSON.parse(event.in_stations || '[]');
                    const outStations = JSON.parse(event.out_stations || '[]');

                    // Backup current status
                    const allStations = [...new Set([...inStations, ...outStations])];
                    for (const stationCode of allStations) {
                        const station = await this.db.query('SELECT * FROM station_status WHERE station_id = (SELECT station_id FROM metro_stations WHERE station_code = ?)', [stationCode]);
                        if (station.length > 0) {
                            await this.db.query('INSERT INTO station_status_backup (event_id, station_id, status_type_id, status_description, status_message) VALUES (?, ?, ?, ?, ?)', [event.event_id, station[0].station_id, station[0].status_type_id, station[0].status_description, station[0].status_message]);
                        }
                    }

                    // Apply event status
                    for (const stationCode of inStations) {
                        await this.db.query('UPDATE station_status SET status_type_id = (SELECT status_type_id FROM operational_status_types WHERE status_name = ?) WHERE station_id = (SELECT station_id FROM metro_stations WHERE station_code = ?)', ['servicio extendido solo entrada', stationCode]);
                    }
                    for (const stationCode of outStations) {
                        await this.db.query('UPDATE station_status SET status_type_id = (SELECT status_type_id FROM operational_status_types WHERE status_name = ?) WHERE station_id = (SELECT station_id FROM metro_stations WHERE station_code = ?)', ['servicio extendido solo salida', stationCode]);
                    }
                }
            });

            // Schedule job to end the event
            const endJobName = `event-end-${event.event_id}`;
            this.addJob({
                name: endJobName,
                schedule: new Date(event.end_time),
                task: async () => {
                    await this.db.query('UPDATE special_events SET is_active = 0 WHERE event_id = ?', [event.event_id]);

                    // Restore status from backup
                    const backups = await this.db.query('SELECT * FROM station_status_backup WHERE event_id = ?', [event.event_id]);
                    for (const backup of backups) {
                        await this.db.query('UPDATE station_status SET status_type_id = ?, status_description = ?, status_message = ? WHERE station_id = ?', [backup.status_type_id, backup.status_description, backup.status_message, backup.station_id]);
                    }

                    // Clean up backup and event
                    await this.db.query('DELETE FROM station_status_backup WHERE event_id = ?', [event.event_id]);
                    await this.db.query('DELETE FROM special_events WHERE event_id = ?', [event.event_id]);
                }
            });

            // Mark event as processed
            await this.db.query('UPDATE special_events SET processed = 1, job_id_start = ?, job_id_end = ? WHERE event_id = ?', [startJobName, endJobName, event.event_id]);
        }
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

        const rule = new schedule.RecurrenceRule();
        const scheduleParts = job.schedule.split(' ');

        rule.minute = scheduleParts[0];
        rule.hour = scheduleParts[1];
        rule.date = scheduleParts[2];
        rule.month = scheduleParts[3];
        rule.dayOfWeek = scheduleParts[4];
        rule.tz = chronosConfig.timezone;

        const scheduledJob = schedule.scheduleJob(rule, jobWrapper);
        job.timer = scheduledJob; // Store the scheduled job instance
        this.jobs.set(jobName, job);
    }

    scheduleIntervalJob(jobName) {
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
