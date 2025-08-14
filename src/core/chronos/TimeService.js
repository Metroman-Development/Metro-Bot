const EventEmitter = require('events');
const timeHelpers = require('./timeHelpers');
const logger = require('../../events/logger');
const DatabaseManager = require('../database/DatabaseManager');
const DatabaseService = require('../database/DatabaseService');
const chronosConfig = require('../../config/chronosConfig');
const moment = require('moment-timezone');

class TimeService extends EventEmitter {
    constructor() {
        super();
        this.db = DatabaseManager.getInstance();
        this.dbService = DatabaseService;
        this.lastFarePeriod = null;
        this.lastServiceStatus = null;
    }

    async initialize() {
        logger.info('[TimeService] Initializing...');
        await this.checkTime();
        logger.info('[TimeService] Initialized.');
    }

    async checkTime() {
        logger.debug('[TimeService] Checking time...');
        await this.checkServiceStatus();
        await this.checkFarePeriod();
        await this.checkEvents();
    }

    async checkFarePeriod() {
        const now = timeHelpers.currentTime;
        let currentFarePeriod = 'NOCHE'; // Default when not operating

        if (timeHelpers.isWithinOperatingHours(now)) {
            const dayType = timeHelpers.getDayType(now);

            if (dayType === 'weekday') {
                currentFarePeriod = 'BAJO'; // Default for weekday operating hours

                if (chronosConfig.farePeriods.PUNTA.some(p => timeHelpers.isTimeBetween(now, p.start, p.end))) {
                    currentFarePeriod = 'PUNTA';
                } else if (chronosConfig.farePeriods.VALLE.some(p => timeHelpers.isTimeBetween(now, p.start, p.end))) {
                    currentFarePeriod = 'VALLE';
                }
            } else {
                // Saturday, Sunday, Festive
                currentFarePeriod = 'BAJO';
            }
        }

        if (this.lastFarePeriod !== currentFarePeriod) {
            logger.info(`[TimeService] Fare period changed from ${this.lastFarePeriod} to ${currentFarePeriod}`);
            this.emit('farePeriodChange', { from: this.lastFarePeriod, to: currentFarePeriod });
            this.lastFarePeriod = currentFarePeriod;
            await this.dbService.updateFarePeriod(currentFarePeriod);
        }
    }

    async checkServiceStatus() {
        const isOperating = timeHelpers.isWithinOperatingHours();

        if (this.lastServiceStatus !== isOperating) {
            if (isOperating) {
                logger.info('[TimeService] Metro service has started.');
                this.emit('serviceStart');
            } else {
                logger.info('[TimeService] Metro service has ended.');
                this.emit('serviceEnd');
            }
            this.lastServiceStatus = isOperating;
        }
    }

    async checkEvents() {
        try {
            const result = await this.db.query('SELECT events FROM system_info WHERE id = ?', [1]);
            let activeEvent = null;
            if (result && result.length > 0 && result[0].events) {
                const events = JSON.parse(result[0].events);
                const now = timeHelpers.currentTime;

                for (const event of events) {
                    // Assuming event has startTime and endTime properties
                    const startTime = moment.tz(event.startTime, chronosConfig.timezone);
                    const endTime = moment.tz(event.endTime, chronosConfig.timezone);

                    if (now.isBetween(startTime, endTime)) {
                        this.emit('activeEvent', event);
                        activeEvent = event;
                        break;
                    }
                }
            }
            await this.dbService.updateActiveEvent(activeEvent);
        } catch (error) {
            // It's possible the 'events' column does not exist yet, or is null.
            if (error.code !== 'ER_BAD_FIELD_ERROR' && (!error.message || !error.message.includes("Cannot read property 'events' of undefined"))) {
                 logger.error('[TimeService] Error checking for events:', error);
            }
        }
    }
}

module.exports = TimeService;
