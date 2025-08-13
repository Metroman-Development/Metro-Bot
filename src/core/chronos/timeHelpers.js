const moment = require('moment-timezone');
const config = require('../../config/chronosConfig');
const logger = require('../../events/logger');

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

            const schedule = {};
            for (const dayType of ['weekday', 'saturday', 'sunday', 'festive']) {
                schedule[dayType] = {
                    service: config.serviceHours[dayType] || this.#DEFAULT_SCHEDULE[dayType].service,
                    peak: (dayType === 'weekday' ? config.farePeriods.PUNTA : []) || this.#DEFAULT_SCHEDULE[dayType].peak
                };
            }
            return schedule;

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

    static isWeekday(date = new Date()) {
        const day = moment(date).tz(config.timezone).day();
        return day >= 1 && day <= 5;
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

    static isWithinOperatingHours(date = new Date()) {
        try {
            const now = moment(date).tz(config.timezone);
            const operatingHours = this.getOperatingHours(this.getDayType(date));
            return this.isTimeBetween(now, operatingHours.opening, operatingHours.closing);
        } catch (error) {
            logger.error('Failed to check if within operating hours:', error);
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

    /**
     * Formats milliseconds into a human-readable duration string
     * @param {number} ms - Duration in milliseconds
     * @param {object} [options] - Formatting options
     * @param {boolean} [options.compact=false] - Use compact format (e.g., "1h5m" instead of "1 hour 5 minutes")
     * @param {number} [options.precision=2] - Number of time units to include
     * @returns {string} Formatted duration string
     */
    static formatDuration(ms, options = {}) {
        if (ms < 0) ms = -ms;
        if (ms === 0) return '0ms';
        
        const { compact = false, precision = 2 } = options;
        const timeUnits = [
            { unit: 'day', ms: 86400000 },
            { unit: 'hour', ms: 3600000 },
            { unit: 'minute', ms: 60000 },
            { unit: 'second', ms: 1000 },
            { unit: 'millisecond', ms: 1 }
        ];

        const parts = [];
        let remaining = ms;

        for (const { unit, ms: unitMs } of timeUnits) {
            if (remaining < unitMs) continue;

            const value = Math.floor(remaining / unitMs);
            remaining %= unitMs;

            const suffix = compact ? unit[0] :
                (value === 1 ? ` ${unit}` : ` ${unit}s`);
            parts.push(`${value}${suffix}`);

            if (parts.length >= precision) break;
        }

        if (compact) {
            return parts.join('');
        }

        if (parts.length > 1) {
            const last = parts.pop();
            return `${parts.join(', ')} and ${last}`;
        }
        return parts[0];
    }

    static getNextTransition() {
        const now = moment().tz(config.timezone);
        const operatingHours = this.getOperatingHours();
        const transitions = [];

        if (this.getDayType() === "weekday") {
            // Add fare period transitions
            Object.entries(config.farePeriods).forEach(([periodType, periods]) => {
                periods.forEach(({ start, end }) => {
                    transitions.push({
                        time: start,
                        type: `start-${periodType.toLowerCase()}`,
                        message: this.getPeriodStartMessage(periodType)
                    });
                    transitions.push({
                        time: end,
                        type: `end-${periodType.toLowerCase()}`,
                        message: this.getPeriodEndMessage(periodType)
                    });
                });
            });
        }

        // Add service transitions
        transitions.push({
            time: operatingHours.opening,
            type: 'service-start',
            message: 'Apertura del servicio'
        });
        transitions.push({
            time: operatingHours.closing,
            type: 'service-end',
            message: 'Cierre del servicio'
        });

        // Create moment objects for today's transitions
        const todayTransitions = transitions.map(t => {
            const transitionTime = moment(t.time, 'HH:mm:ss');
            return {
                ...t,
                moment: moment(now)
                    .set({
                        hour: transitionTime.hours(),
                        minute: transitionTime.minutes(),
                        second: transitionTime.seconds(),
                        millisecond: 0
                    })
            };
        });

        // Add tomorrow's opening
        const tomorrowOpening = {
            time: operatingHours.opening,
            type: 'service-start',
            message: 'Apertura del servicio',
            moment: moment(now)
                .add(1, 'day')
                .set({
                    hour: moment(operatingHours.opening, 'HH:mm:ss').hours(),
                    minute: moment(operatingHours.opening, 'HH:mm:ss').minutes(),
                    second: moment(operatingHours.opening, 'HH:mm:ss').seconds(),
                    millisecond: 0
                })
        };

        // Find next transition
        const allTransitions = [...todayTransitions, tomorrowOpening];
        const nextTransition = allTransitions
            .filter(t => t.moment.isAfter(now))
            .sort((a, b) => a.moment - b.moment)[0];

        const formattedTime = nextTransition 
            ? moment(nextTransition.time, 'HH:mm:ss').format('HH:mm')
            : operatingHours.opening;

        return {
            ...nextTransition,
            time: formattedTime
        };
    }

    static getPeriodStartMessage(periodType) {
        const messages = {
            'PUNTA': 'Inicio hora punta',
            'VALLE': 'Inicio horario normal',
            'BAJO': 'Inicio horario bajo'
        };
        return messages[periodType] || 'Inicio de periodo';
    }

    static getPeriodEndMessage(periodType) {
        const messages = {
            'PUNTA': 'Fin hora punta',
            'VALLE': 'Fin horario normal',
            'BAJO': 'Fin horario bajo'
        };
        return messages[periodType] || 'Fin de periodo';
    }

    static isValidTimeString(timeStr) {
        return moment(timeStr, 'HH:mm:ss', true).isValid() ||
               moment(timeStr, 'HH:mm', true).isValid();
    }

    static isTimeBetween(momentTime, startStr, endStr) {
        if (!momentTime || !momentTime.isValid()) {
            throw new Error('Invalid momentTime provided');
        }
        if (!this.isValidTimeString(startStr) || !this.isValidTimeString(endStr)) {
            throw new Error('Invalid time string format. Use HH:mm');
        }

        const format = 'HH:mm';
        const current = momentTime.clone().tz(config.timezone);
        
        const start = current.clone()
            .set({
                hour: moment(startStr, format).hour(),
                minute: moment(startStr, format).minute(),
                second: 0,
                millisecond: 0
            });

        const end = current.clone()
            .set({
                hour: moment(endStr, format).hour(),
                minute: moment(endStr, format).minute(),
                second: 0,
                millisecond: 0
            });

        // Handle midnight crossing
        if (end.isBefore(start)) {
            return current.isSameOrAfter(start) || current.isBefore(end);
        }

        return current.isSameOrAfter(start) && current.isBefore(end);
    }
}

module.exports = TimeHelpers;
