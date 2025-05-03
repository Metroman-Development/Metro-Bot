const moment = require('moment-timezone');
const chronosConfig = require('../../../config/chronosConfig');
const logger = require('../../../events/logger');

module.exports = {
    /**
     * Gets current service period (BAJO/PUNTA/VALLE)
     * @returns {String} Current period identifier
     */
    getCurrentPeriod: () => {
        try {
            const now = moment().tz(chronosConfig.timezone);
            const currentTime = now.format('HH:mm');

            // Check BAJO first (overnight period)
            if (chronosConfig.horarioPeriodos.BAJO.some(p => 
                currentTime >= p.inicio && currentTime < p.fin)) {
                return 'BAJO';
            }

            // Check PUNTA periods
            if (chronosConfig.horarioPeriodos.PUNTA.some(p => 
                currentTime >= p.inicio && currentTime < p.fin)) {
                return 'PUNTA';
            }

            return 'VALLE';
        } catch (error) {
            logger.error('Failed to get current period:', error);
            return 'VALLE'; // Default fallback
        }
    },

    /**
     * Checks if express service should run
     * @returns {Boolean} True if express service should be active
     */
    shouldRunExpress: () => {
        try {
            const now = moment().tz(chronosConfig.timezone);
            const currentTime = now.format('HH:mm');
            const dayType = this.getCurrentDayType();
            
            // Express only runs on weekdays
            if (dayType !== 'Semana') return false;

            return (
                (currentTime >= chronosConfig.horarioExpreso.morning[0] && 
                 currentTime < chronosConfig.horarioExpreso.morning[1]) ||
                (currentTime >= chronosConfig.horarioExpreso.evening[0] && 
                 currentTime < chronosConfig.horarioExpreso.evening[1])
            );
        } catch (error) {
            logger.error('Failed to check express service:', error);
            return false;
        }
    },

    /**
     * Gets current day type classification
     * @returns {String} 'Semana'|'Sábado'|'Domingo'
     */
    getCurrentDayType: () => {
        try {
            const now = moment().tz(chronosConfig.timezone);
            const dateStr = now.format('YYYY-MM-DD');
            
            if (chronosConfig.festiveDays.includes(dateStr)) {
                return 'Domingo'; // Treat festive days like Sundays
            }
            
            const day = now.day();
            return day === 6 ? 'Sábado' : day === 0 ? 'Domingo' : 'Semana';
        } catch (error) {
            logger.error('Failed to get day type:', error);
            return 'Semana'; // Default to weekday
        }
    },

    /**
     * Checks if current time is within service hours
     * @returns {Boolean} True if service is active
     */
    isServiceHour: () => {
        try {
            const now = moment().tz(chronosConfig.timezone);
            const currentTime = now.format('HH:mm');
            const dayType = this.getCurrentDayType();
            const [open, close] = chronosConfig.horario[dayType];

            return currentTime >= open && currentTime < close;
        } catch (error) {
            logger.error('Failed to check service hours:', error);
            return false;
        }
    },

    /**
     * Gets upcoming schedule transitions
     * @returns {Array} List of upcoming transitions with timestamps
     */
    getUpcomingTransitions: () => {
        try {
            const now = moment().tz(chronosConfig.timezone);
            const dayType = this.getCurrentDayType();
            const schedule = chronosConfig.horario[dayType];
            const periods = chronosConfig.horarioPeriodos;
            
            const allTransitions = [
                schedule[0], // Opening time
                schedule[1], // Closing time
                ...periods.PUNTA.flatMap(p => [p.inicio, p.fin]),
                ...periods.BAJO.flatMap(p => [p.inicio, p.fin])
            ].filter(t => t > now.format('HH:mm'));

            return allTransitions.map(time => ({
                time,
                type: this._determineTransitionType(time, dayType)
            })).sort((a, b) => a.time.localeCompare(b.time));
        } catch (error) {
            logger.error('Failed to get upcoming transitions:', error);
            return [];
        }
    },

    /**
     * Gets next express service window
     * @returns {Object|null} Next express period or null
     */
    getNextExpressWindow: () => {
        try {
            const now = moment().tz(chronosConfig.timezone);
            const currentTime = now.format('HH:mm');
            const dayType = this.getCurrentDayType();
            
            if (dayType !== 'Semana') return null;

            const morning = chronosConfig.horarioExpreso.morning;
            const evening = chronosConfig.horarioExpreso.evening;

            if (currentTime < morning[0]) {
                return { period: 'morning', start: morning[0], end: morning[1] };
            } else if (currentTime < evening[0]) {
                return { period: 'evening', start: evening[0], end: evening[1] };
            }
            
            return null;
        } catch (error) {
            logger.error('Failed to get next express window:', error);
            return null;
        }
    },

    // Private helper method
    _determineTransitionType: (time, dayType) => {
        const periods = chronosConfig.horarioPeriodos;
        
        if (time === chronosConfig.horario[dayType][0]) return 'SERVICE_OPEN';
        if (time === chronosConfig.horario[dayType][1]) return 'SERVICE_CLOSE';
        if (periods.PUNTA.some(p => p.inicio === time)) return 'PEAK_START';
        if (periods.PUNTA.some(p => p.fin === time)) return 'PEAK_END';
        if (periods.BAJO.some(p => p.inicio === time)) return 'OVERNIGHT_START';
        if (periods.BAJO.some(p => p.fin === time)) return 'OVERNIGHT_END';
        
        return 'UNKNOWN';
    }
};