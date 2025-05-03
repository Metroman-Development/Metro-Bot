// modules/chronos/utils/timeHelpers.js
// modules/chronos/utils/timeHelpers.js
const moment = require('moment-timezone');
const config = require('../../../config/chronosConfig');
const logger = require('../../../events/logger');

class TimeHelpers {
    static #DEFAULT_SCHEDULE = {
        weekday: {
            service: ['06:00', '23:00'],
            peak: [
                { start: '07:30', end: '09:30' },
                { start: '18:00', end: '20:00' }
            ]
        },
        saturday: {
            service: ['06:30', '23:00'],
            peak: []
        },
        sunday: {
            service: ['07:30', '23:00'],
            peak: []
        },
        festive: {
            service: ['07:30', '23:00'],
            peak: []
        }
    };

    static #currentEvent = null;

    static getScheduleConfig() {
        try {
            if (!config.serviceHours || !config.farePeriods) {
                logger.warn('Using default schedule - missing config');
                return this.#DEFAULT_SCHEDULE;
            }

            return {
                weekday: {
                    service: config.serviceHours.weekday || this.#DEFAULT_SCHEDULE.weekday.service,
                    peak: config.farePeriods.PUNTA || this.#DEFAULT_SCHEDULE.weekday.peak
                },
                saturday: {
                    service: config.serviceHours.saturday || this.#DEFAULT_SCHEDULE.saturday.service,
                    peak: []
                },
                sunday: {
                    service: config.serviceHours.sunday || this.#DEFAULT_SCHEDULE.sunday.service,
                    peak: []
                },
                festive: {
                    service: config.serviceHours.sunday || this.#DEFAULT_SCHEDULE.sunday.service,
                    peak: []
                }
            };
        } catch (error) {
            logger.error('Failed to get schedule config:', error);
            return this.#DEFAULT_SCHEDULE;
        }
    }

    static getOperatingHours(dayType = this.getDayType()) {
        try {
            const schedule = this.getScheduleConfig();
            const daySchedule = schedule[dayType] || schedule.weekday;
            
            return {
                opening: daySchedule.service[0],
                closing: daySchedule.service[1],
                peakHours: daySchedule.peak,
                isExtended: this.isExtendedHoursActive()
            };
        } catch (error) {
            logger.error('Failed to get operating hours:', error);
            return {
                opening: '06:00',
                closing: '23:00',
                peakHours: [],
                isExtended: false
            };
        }
    }

    static getDayType(date = new Date()) {
        try {
            const time = moment(date).tz(config.timezone);
            const dateStr = time.format('YYYY-MM-DD');
            
            if (config.festiveDays && config.festiveDays.includes(dateStr)) {
                return 'festive';
            }
            
            const day = time.day();
            return day === 0 ? 'sunday' :
                   day === 6 ? 'saturday' : 'weekday';
        } catch (error) {
            logger.error('Failed to get day type:', error);
            return 'weekday';
        }
    }

    static getCurrentPeriod(date = new Date()) {
        try {
            const time = moment(date).tz(config.timezone);
            const timeStr = time.format('HH:mm');
            const dayType = this.getDayType(date);
            const schedule = this.getScheduleConfig()[dayType];

            if (this.isSpecialEventActive(date)) {
                return { type: 'EVENT', name: 'Evento Especial' };
            }

            const isPeak = schedule.peak.some(period => 
                timeStr >= period.start && timeStr < period.end
            );

            if (isPeak) return { type: 'PUNTA', name: 'Hora Punta' };
            if (time.hours() < 6 || time.hours() >= 23) return { type: 'BAJO', name: 'Horario Reducido' };
            return { type: 'VALLE', name: 'Horario Normal' };
        } catch (error) {
            logger.error('Failed to get current period:', error);
            return { type: 'UNKNOWN', name: 'Desconocido' };
        }
    }

    static isSpecialEventActive(date = new Date()) {
        try {
            if (!config.events || !Array.isArray(config.events)) return false;
            
            const now = moment(date).tz(config.timezone);
            return config.events.some(event => {
                if (!event.date || !event.startTime || !event.endTime) return false;
                
                const start = moment(`${event.date} ${event.startTime}`);
                const end = moment(`${event.date} ${event.endTime}`);
                
                return now.isBetween(start, end);
            });
        } catch (error) {
            logger.error('Failed to check special event:', error);
            return false;
        }
    }

    static isExtendedHoursActive() {
        try {
            // Implement your extended hours logic here
            return false;
        } catch (error) {
            logger.error('Failed to check extended hours:', error);
            return false;
        }
    }

    static isExpressActive() {
        try {
            if (!config.expressHours) return false;
            
            const now = moment().tz(config.timezone);
            const currentTime = now.format('HH:mm');
            const day = now.day();

            // Express only runs on weekdays (1-5)
            if (day === 0 || day === 6) return false;

            return (
                (currentTime >= config.expressHours.morning.start && 
                 currentTime < config.expressHours.morning.end) ||
                (currentTime >= config.expressHours.evening.start && 
                 currentTime < config.expressHours.evening.end)
            );
        } catch (error) {
            logger.error('Failed to check express status:', error);
            return false;
        }
    }

    static formatTime(time) {
        try {
            return moment(time, 'HH:mm').format('h:mm A');
        } catch (error) {
            logger.error('Failed to format time:', error);
            return time;
        }
    }

    static formatDateTime(date) {
        try {
            return moment(date).tz(config.timezone).format('DD/MM/YYYY h:mm A');
        } catch (error) {
            logger.error('Failed to format date:', error);
            return '--/--/---- --:-- --';
        }
    }

    static getEventDetails() {
        try {
            if (!this.#currentEvent) {
                const activeEvent = config.events?.find(event => 
                    this.isSpecialEventActive(moment(`${event.date} ${event.startTime}`))
                );
                this.#currentEvent = activeEvent || null;
            }
            return this.#currentEvent;
        } catch (error) {
            logger.error('Failed to get event details:', error);
            return null;
        }
    }


_getDefaultHours() {

    try {

        return {

            weekday: this.#DEFAULT_SCHEDULE.weekday.service,

            saturday: this.#DEFAULT_SCHEDULE.saturday.service,

            sunday: this.#DEFAULT_SCHEDULE.sunday.service,

            festive: this.#DEFAULT_SCHEDULE.festive.service

        };

    } catch (error) {

        logger.error('Failed to get default hours:', error);

        return {

            weekday: ['06:00', '23:00'],

            saturday: ['06:30', '23:00'],

            sunday: ['07:30', '23:00'],

            festive: ['07:30', '23:00']

        };

    }

}

// In timeHelpers.js - adding to the TimeHelpers class

static getRawScheduleConfig() {

    try {

        return this.getScheduleConfig();

    } catch (error) {

        logger.error('Failed to get raw schedule config:', error);

        return this.#DEFAULT_SCHEDULE;

    }

}
}

module.exports = TimeHelpers;

    

