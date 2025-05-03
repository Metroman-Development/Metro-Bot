const moment = require('moment-timezone');
const config = require('../config/statusConfig');
const chronosConfig = require('../../../config/chronosConfig');
const logger = require('../../../events/logger');

module.exports = {
    getCurrentSchedule() {
        try {
            const now = moment().tz(config.TIMEZONE);
            const dayType = this._getDayType(now);
            const schedule = this._getScheduleForDayType(dayType);
            
            return {
                current: schedule,
                isPeak: this._isPeakHours(now),
                isReduced: this._isReducedHours(now),
                isEvent: this._isFestiveDay(now),
                nextTransition: this.getNextTransition()
            };
        } catch (error) {
            logger.error('SCHEDULE_FETCH_FAILED', error);
            return {
                current: chronosConfig.schedule.weekday,
                isPeak: false,
                isReduced: false,
                isEvent: false,
                nextTransition: null
            };
        }
    },

    // Fix the timezone handling in getNextTransition()
getNextTransition() {
    try {
        const now = moment().tz(config.TIMEZONE || 'UTC'); // Add fallback to UTC
        if (!now.tz()) {
            throw new Error('Invalid timezone configuration');
        }
        
        const periods = [...chronosConfig.schedule.peak, ...chronosConfig.schedule.offpeak];
        let nextTransition;
        
        periods.forEach(period => {
            const startTime = moment.tz(`${now.format('YYYY-MM-DD')} ${period.start}`, 'YYYY-MM-DD HH:mm', config.TIMEZONE || 'UTC');
            if (startTime.isValid() && startTime.isAfter(now)) {
                const periodType = chronosConfig.schedule.peak.includes(period) ? 'PEAK' : 'OFFPEAK';
                if (!nextTransition || startTime.isBefore(nextTransition.time)) {
                    nextTransition = { 
                        time: startTime, 
                        type: periodType,
                        displayText: this._getTransitionText(periodType)
                    };
                }
            }
        });

        return nextTransition || { 
            time: moment.tz(now, config.TIMEZONE || 'UTC').add(1, 'day').startOf('day'),
            type: 'END_OF_DAY',
            displayText: 'End of service'
        };
    } catch (error) {
        logger.error('TRANSITION_FETCH_FAILED', error.message);
        return null;
    }
}, 

    _getDayType(now) {
        const day = now.day();
        if (chronosConfig.festiveDays.includes(now.format('YYYY-MM-DD'))) return 'festive';
        if (day === 0) return 'sunday';
        if (day === 6) return 'saturday';
        return 'weekday';
    },

    _getScheduleForDayType(dayType) {
        const map = {
            'weekday': chronosConfig.schedule.weekday,
            'saturday': chronosConfig.schedule.saturday,
            'sunday': chronosConfig.schedule.sunday,
            'festive': chronosConfig.schedule.sunday // Using Sunday schedule for festive days
        };
        return map[dayType];
    },

    _isPeakHours(now) {
        return chronosConfig.schedule.peak.some(period => 
            now.isBetween(
                moment.tz(`${now.format('YYYY-MM-DD')} ${period.start}`, config.TIMEZONE),
                moment.tz(`${now.format('YYYY-MM-DD')} ${period.end}`, config.TIMEZONE)
            )
        );
    },

    _isReducedHours(now) {
        // Reduced hours logic if needed (e.g., late night hours)
        return false;
    },

    _isFestiveDay(now) {
        return chronosConfig.festiveDays.includes(now.format('YYYY-MM-DD'));
    },

    _getTransitionText(type) {
        const texts = {
            'PEAK': 'Peak hours start',
            'OFFPEAK': 'Off-peak hours start',
            'END_OF_DAY': 'End of service'
        };
        return texts[type] || type;
    }
};