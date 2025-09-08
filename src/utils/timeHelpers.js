const moment = require('moment-timezone');
const config = require('../config/chronosConfig');
const logger =require('../events/logger');

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

    #currentEvent = null;
    currentTime = null;

    constructor(date) {
        this.currentTime = date ? moment(date).tz(config.timezone) : moment().tz(config.timezone);
    }

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

    getOperatingHours() {
        try {
            const schedule = TimeHelpers.getScheduleConfig();
            const daySchedule = schedule[this.getDayType()] || schedule.weekday;

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

    getDayType() {
        try {
            const time = this.currentTime;
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

    isWeekday() {
        const time = this.currentTime;
        const day = time.day();
        return day >= 1 && day <= 5;
    }

    getCurrentPeriod() {
        try {
            const time = this.currentTime;

            if (!this.isWithinOperatingHours()) {
                return { type: 'CERRADO', name: 'Servicio Cerrado' };
            }

            const timeStr = time.format('HH:mm');
            const dayType = this.getDayType();

            if (this.isSpecialEventActive()) {
                return { type: 'EVENT', name: 'Evento Especial' };
            }

            if (dayType === 'saturday' || dayType === 'sunday' || dayType === 'festive') {
                return { type: 'VALLE', name: 'Horario Normal' };
            }

            for (const periodType in config.farePeriods) {
                if (config.farePeriods.hasOwnProperty(periodType)) {
                    const isCurrentPeriod = config.farePeriods[periodType].some(period =>
                        TimeHelpers.isTimeBetween(time, period.start, period.end)
                    );
                    if (isCurrentPeriod) {
                        let name = 'Desconocido';
                        if (periodType === 'PUNTA') name = 'Hora Punta';
                        if (periodType === 'VALLE') name = 'Horario Normal';
                        if (periodType === 'BAJO') name = 'Horario Bajo';
                        if (periodType === 'NOCHE') name = 'Horario Nocturno';
                        return { type: periodType, name: name };
                    }
                }
            }

            return { type: 'VALLE', name: 'Horario Normal' }; // Default for weekdays if no other period matches
        } catch (error) {
            logger.error('Failed to get current period:', error);
            return { type: 'UNKNOWN', name: 'Desconocido' };
        }
    }

    isSpecialEventActive() {
        try {
            if (!config.events || !Array.isArray(config.events)) return false;

            const now = this.currentTime;
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

    isWithinOperatingHours() {
        try {
            const now = this.currentTime;
            const operatingHours = this.getOperatingHours();
            return TimeHelpers.isTimeBetween(now, operatingHours.opening, operatingHours.closing);
        } catch (error) {
            logger.error('Failed to check if within operating hours:', error);
            return false;
        }
    }

    isExtendedHoursActive() {
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

    getEventDetails() {
        try {
            if (!this.#currentEvent) {
                const activeEvent = config.events?.find(event =>
                    this.isSpecialEventActive()
                );
                this.#currentEvent = activeEvent || null;
            }
            return this.#currentEvent;
        } catch (error) {
            logger.error('Failed to get event details:', error);
            return null;
        }
    }

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

    getNextTransition() {
        const now = this.currentTime;
        const operatingHours = this.getOperatingHours();
        const transitions = [];

        if (this.getDayType() === "weekday") {
            // Add fare period transitions
            Object.entries(config.farePeriods).forEach(([periodType, periods]) => {
                periods.forEach(({ start, end }) => {
                    transitions.push({
                        time: start,
                        type: `start-${periodType.toLowerCase()}`,
                        message: TimeHelpers.getPeriodStartMessage(periodType)
                    });
                    transitions.push({
                        time: end,
                        type: `end-${periodType.toLowerCase()}`,
                        message: TimeHelpers.getPeriodEndMessage(periodType)
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

        const currentTime = momentTime.tz(config.timezone).format('HH:mm');

        // Handle overnight period
        if (endStr < startStr) {
            return currentTime >= startStr || currentTime < endStr;
        }

        return currentTime >= startStr && currentTime < endStr;
    }
    static getTimestamp(date) {
        if (!date) {
            return null;
        }
        return new Date(date);
    }
}

module.exports = TimeHelpers;
