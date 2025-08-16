const EventEmitter = require('events');
const DailyReloadJob = require('../jobs/DailyReloadJob');
const ServiceHoursJob = require('../jobs/ServiceHoursJob');
const ExpressServiceJob = require('../jobs/ExpressServiceJob');
const SpecialEventsJob = require('../jobs/SpecialEventsJob');
const Logger = require('../utilities/Logger');

class ScheduleManager extends EventEmitter {
    constructor(client) {
        super(); // This is crucial
        this.client = client;
        this.logger = new Logger(client);
        
        this.jobs = {
            dailyReload: new DailyReloadJob(client),
            serviceHours: new ServiceHoursJob(client),
            expressService: new ExpressServiceJob(client),
            specialEvents: new SpecialEventsJob(client)
        };
    }

    async initialize() {
        try {
            await Promise.all([
                this.jobs.dailyReload.initialize(),
                this.jobs.serviceHours.scheduleAll(),
                this.jobs.expressService.scheduleAll(),
                this.jobs.specialEvents.scheduleEvents()
            ]);
            
            this.logger.log('Schedule Manager', 'All jobs initialized successfully');
            this.emit('ready'); // Emit ready event
        } catch (error) {
            this.logger.error('Schedule Manager', 'Initialization failed', error);
            this.emit('error', error);
            throw error;
        }
    }

    


    createDailyReloadJob() {
        const rule = new schedule.RecurrenceRule();
        rule.tz = this.timezone;
        rule.hour = 3;
        rule.minute = 0;

        return schedule.scheduleJob(rule, async () => {
            const startTime = moment().tz(this.timezone).format('LLLL');
            await this.sendLogEmbed('🔄 Daily Reload', `Started at ${startTime}`);

            try {
                await this.handleDailyReload();
                await this.sendLogEmbed(
                    '🆗 Reload Complete',
                    `Finished at ${moment().tz(this.timezone).format('LLLL')}`,
                    [{ name: 'Active Jobs', value: this.jobs.size.toString() }],
                    0x00FF00
                );
            } catch (error) {
                await this.sendLogEmbed(
                    '⚠️ Reload Failed',
                    error.message,
                    [{ name: 'Retry', value: 'Automatically retrying tomorrow' }],
                    0xFFA500
                );
            }
        });
    }

    createServiceMonitorJob() {
        // Runs every 5 minutes to verify services
        return schedule.scheduleJob('*/5 * * * *', async () => {
            const status = {
                runningJobs: this.jobs.size,
                nextReload: this.jobs.get('daily-reload')?.nextInvocation().format('HH:mm') || 'None',
                eventActive: this.eventScheduler.currentEvent ? 'Yes' : 'No'
            };

            await this.sendLogEmbed(
                '📊 Service Monitor',
                'Current system status',
                [
                    { name: 'Active Jobs', value: status.runningJobs.toString(), inline: true },
                    { name: 'Next Reload', value: status.nextReload, inline: true },
                    { name: 'Event Active', value: status.eventActive, inline: true }
                ],
                0x3498DB
            );
        });
    }

    // === SERVICE MANAGEMENT === //
    async handleDailyReload() {
        // 1. Cancel all existing jobs
        this.jobs.forEach(job => job.cancel());
        this.jobs.clear();

        // 2. Reinitialize subsystems
        await this.eventScheduler.shutdown();
        await this.eventScheduler.init();

        // 3. Reschedule core jobs
        this.jobs.set('daily-reload', this.createDailyReloadJob());
        this.jobs.set('service-monitor', this.createServiceMonitorJob());
    }

    // === UTILITIES === //
    async sendLogEmbed(title, description, fields = [], color = 0x0099FF) {
        try {
            const channel = await this.client.channels.fetch(this.logChannelId);
            if (!channel) return;

            await channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(title)
                        .setDescription(description)
                        .addFields(fields)
                        .setColor(color)
                        .setTimestamp()
                ]
            });
        } catch (error) {
            logger.error(`Failed to send log embed: ${error.message}`);
        }
    }

    shutdown() {
        this.jobs.forEach((job, name) => {
            job.cancel();
            logger.info(`Cancelled job: ${name}`);
        });
        this.jobs.clear();
        this.eventScheduler.shutdown();
    }
}

module.exports = ScheduleManager;
