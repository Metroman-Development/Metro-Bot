const logger = require('../events/logger');
const schedule = require('node-schedule');

const statusMapping = {
    'normal': 'normal',
    'closed': 'cerrada',
    'ingress_only': 'servicio extendido solo entrada',
    'egress_only': 'servicio extendido solo salida',
    'no_combination': 'sin combinacion',
    'delayed': 'con retraso',
    'special_hours': 'horario especial'
};

class SchedulerService {
    constructor(db, dataManager, changeAnnouncer, statusEmbedManager, metroInfoProvider, timezone) {
        this.db = db;
        this.dataManager = dataManager;
        this.changeAnnouncer = changeAnnouncer;
        this.statusEmbedManager = statusEmbedManager;
        this.metroInfoProvider = metroInfoProvider;
        this.jobs = new Map();
        this.running = new Set();
        this.timezone = timezone;
    }

    async scheduleExtensionOfService(lineId, startTime, endTime, affectedStations) {
        logger.info(`[SchedulerService] Scheduling extension of service for line ${lineId}`);

        const eventResult = await this.db.query(
            'INSERT INTO metro_events (event_name, description, event_start_datetime, event_end_datetime, is_active) VALUES (?, ?, ?, ?, ?)',
            ['extension', `Extension of service for line ${lineId}`, startTime, endTime, false]
        );
        const eventId = eventResult.insertId;

        await this.db.query(
            'INSERT INTO event_details (event_id, line_code, detail_type, description) VALUES (?, ?, ?, ?)',
            [eventId, lineId, 'note', `Service extension for line ${lineId}`]
        );

        for (const station of affectedStations) {
            await this.db.query(
                'INSERT INTO event_station_status (event_id, station_code, status) VALUES (?, ?, ?)',
                [eventId, station.station_code, station.status]
            );
        }

        await this.checkAndScheduleEvents();

        if (this.changeAnnouncer) {
            const eventInfo = {
                name: `Extension for line ${lineId}`,
                endTime: endTime.toLocaleTimeString(),
                affectedLines: [lineId]
            };
            await this.changeAnnouncer.announceExtendedService('start', eventInfo);
        }
    }

    async checkAndScheduleEvents() {
        const metroInfoProvider = this.metroInfoProvider;
        if (!this.metroInfoProvider) {
            logger.warn('[SchedulerService] MetroInfoProvider not available.');
            return;
        }

        const eventsData = this.metroInfoProvider.getFullData().events;
        if (!eventsData || !eventsData.upcomingEvents) {
            return;
        }

        for (const eventData of eventsData.upcomingEvents) {
            const { event, details, stationStatus } = eventData;
            const now = new Date();
            const startTime = new Date(event.event_start_datetime);
            const endTime = new Date(event.event_end_datetime);

            if (now >= startTime && now < endTime) {
                // Event is currently active, apply status immediately
                await this.db.query('UPDATE metro_events SET is_active = 1 WHERE id = ?', [event.id]);
                // Backup current status
                for (const status of stationStatus) {
                    const station = await this.db.query('SELECT * FROM station_status WHERE station_id = (SELECT station_id FROM metro_stations WHERE station_code = ?)', [status.station_code]);
                    if (station.length > 0) {
                        await this.db.query('INSERT INTO event_station_status_backup (event_id, station_id, status_type_id, status_description, status_message) VALUES (?, ?, ?, ?, ?)', [event.id, station[0].station_id, station[0].status_type_id, station[0].status_description, station[0].status_message]);
                    }
                }
                // Apply event status
                for (const status of stationStatus) {
                    const fullStatus = statusMapping[status.status];
                    const stationResult = await this.db.query('SELECT station_id FROM metro_stations WHERE station_code = ?', [status.station_code]);
                    if (stationResult.length > 0) {
                        const stationId = stationResult[0].station_id;
                        const statusTypeIdResult = await this.db.query('SELECT status_type_id FROM operational_status_types WHERE status_name = ?', [fullStatus]);
                        if (statusTypeIdResult.length > 0) {
                            const statusTypeId = statusTypeIdResult[0].status_type_id;
                            const existingStatus = await this.db.query('SELECT * FROM station_status WHERE station_id = ?', [stationId]);
                            if (existingStatus.length > 0) {
                                await this.db.query('UPDATE station_status SET status_type_id = ? WHERE station_id = ?', [statusTypeId, stationId]);
                            } else {
                                await this.db.query('INSERT INTO station_status (station_id, status_type_id) VALUES (?, ?)', [stationId, statusTypeId]);
                            }
                        }
                    }
                }
            } else if (now < startTime) {
                // Schedule job to start the event
                const startJobName = `event-start-${event.id}`;
                this.addJob({
                    name: startJobName,
                    schedule: startTime,
                    task: async () => {
                        await this.db.query('UPDATE metro_events SET is_active = 1 WHERE id = ?', [event.id]);

                        // Backup current status
                        for (const status of stationStatus) {
                            const station = await this.db.query('SELECT * FROM station_status WHERE station_id = (SELECT station_id FROM metro_stations WHERE station_code = ?)', [status.station_code]);
                            if (station.length > 0) {
                                await this.db.query('INSERT INTO event_station_status_backup (event_id, station_id, status_type_id, status_description, status_message) VALUES (?, ?, ?, ?, ?)', [event.id, station[0].station_id, station[0].status_type_id, station[0].status_description, station[0].status_message]);
                            }
                        }

                        // Apply event status
                        for (const status of stationStatus) {
                            const fullStatus = statusMapping[status.status];
                            const stationResult = await this.db.query('SELECT station_id FROM metro_stations WHERE station_code = ?', [status.station_code]);
                            if (stationResult.length > 0) {
                                const stationId = stationResult[0].station_id;
                                const statusTypeIdResult = await this.db.query('SELECT status_type_id FROM operational_status_types WHERE status_name = ?', [fullStatus]);
                                if (statusTypeIdResult.length > 0) {
                                    const statusTypeId = statusTypeIdResult[0].status_type_id;
                                    const existingStatus = await this.db.query('SELECT * FROM station_status WHERE station_id = ?', [stationId]);
                                    if (existingStatus.length > 0) {
                                        await this.db.query('UPDATE station_status SET status_type_id = ? WHERE station_id = ?', [statusTypeId, stationId]);
                                    } else {
                                        await this.db.query('INSERT INTO station_status (station_id, status_type_id) VALUES (?, ?)', [stationId, statusTypeId]);
                                    }
                                }
                            }
                        }

                        // Force a refresh of the data provider to ensure consistency
                        const dbData = await this.dataManager.dbDataManager.getDbRawData();
                        await this.metroInfoProvider.compareAndSyncData(dbData);

                        if (this.statusEmbedManager) {
                            const data = this.metroInfoProvider.getFullData();
                            await this.statusEmbedManager.updateAllEmbeds(data);
                        }
                    }
                });
            }

            // Schedule job to end the event
            if (now < endTime) {
                const endJobName = `event-end-${event.id}`;
                this.addJob({
                    name: endJobName,
                    schedule: endTime,
                    task: async () => {
                        await this.db.query('UPDATE metro_events SET is_active = 0 WHERE id = ?', [event.id]);

                        // Restore status from backup
                        const backups = await this.db.query('SELECT * FROM event_station_status_backup WHERE event_id = ?', [event.id]);
                        for (const backup of backups) {
                            await this.db.query('UPDATE station_status SET status_type_id = ?, status_description = ?, status_message = ? WHERE station_id = ?', [backup.status_type_id, backup.status_description, backup.status_message, backup.station_id]);
                        }

                        // Clean up backup
                        await this.db.query('DELETE FROM event_station_status_backup WHERE event_id = ?', [event.id]);

                        if (this.changeAnnouncer && event.event_name === 'extension') {
                            const eventInfo = {
                                name: event.description,
                                endTime: new Date(event.event_end_datetime).toLocaleTimeString(),
                                affectedLines: details ? [details.line_code] : []
                            };
                            await this.changeAnnouncer.announceExtendedService('end', eventInfo);
                        }

                        // Force a refresh of the data provider to ensure consistency
                        const dbData = await this.dataManager.dbDataManager.getDbRawData();
                        await this.metroInfoProvider.compareAndSyncData(dbData);

                        if (this.statusEmbedManager) {
                            const data = this.metroInfoProvider.getFullData();
                            await this.statusEmbedManager.updateAllEmbeds(data);
                        }
                    }
                });
            }
        }
    }

    addJob(job) {
        if (!job.name || !(job.interval || job.schedule) || !job.task) {
            throw new Error('Job must have a name, task, and either an interval or schedule.');
        }
        if (this.jobs.has(job.name)) {
            logger.warn(`[SchedulerService] Job "${job.name}" already exists. It will be overwritten.`);
            const oldJob = this.jobs.get(job.name);
            if(oldJob && oldJob.timer) {
                oldJob.timer.cancel();
            }
        }

        if (job.schedule && job.schedule instanceof Date) {
            const jobWrapper = async () => {
                if (this.running.has(job.name)) {
                    logger.warn(`[SchedulerService] Job "${job.name}" is already running. Skipping this execution.`);
                    return;
                }
                try {
                    this.running.add(job.name);
                    logger.info(`[SchedulerService] Starting job: ${job.name}`);
                    await job.task();
                    logger.info(`[SchedulerService] Finished job: ${job.name}`);
                } catch (error) {
                    logger.error(`[SchedulerService] Error in job ${job.name}:`, error);
                } finally {
                    this.running.delete(job.name);
                    this.jobs.delete(job.name);
                }
            };
            const scheduledJob = schedule.scheduleJob(job.schedule, jobWrapper);
            job.timer = scheduledJob;
            this.jobs.set(job.name, job);
            logger.info(`[SchedulerService] Job dynamically scheduled: ${job.name} at ${job.schedule}`);
        } else {
            this.jobs.set(job.name, { ...job, timer: null });
            logger.info(`[SchedulerService] Job added: ${job.name}`);
        }
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
        rule.tz = this.timezone;

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
