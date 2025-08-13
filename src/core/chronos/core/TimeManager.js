const moment = require('moment-timezone');

class TimeManager {
    constructor(timezone = 'America/Santiago') {
        if (!moment.tz.zone(timezone)) {
            throw new Error(`Invalid timezone: ${timezone}`);
        }
        this.timezone = timezone;
    }

    getCurrentTimestamp(format = 'YYYY-MM-DD HH:mm:ss') {
        return moment().tz(this.timezone).format(format);
    }

    createSchedule(hours, minutes) {
        return {
            hour: hours,
            minute: minutes,
            tz: this.timezone
        };
    }

    isCurrentlyOperating(hoursConfig) {
        const now = moment().tz(this.timezone);
        const dayType = this.getDayType();
        
        if (!hoursConfig[dayType]) return false;
        
        const [startHour, startMinute] = hoursConfig[dayType].start.split(':').map(Number);
        const [endHour, endMinute] = hoursConfig[dayType].end.split(':').map(Number);
        
        const startTime = moment().tz(this.timezone).set({ hour: startHour, minute: startMinute });
        const endTime = moment().tz(this.timezone).set({ hour: endHour, minute: endMinute });
        
        return now.isBetween(startTime, endTime);
    }

    getDayType() {
        const now = moment().tz(this.timezone);
        if (now.day() === 6) return 'saturday';
        if (now.day() === 0) return 'sunday';
        return 'weekday';
    }

    timeUntilNextAction(targetTime) {
        const [targetHour, targetMinute] = targetTime.split(':').map(Number);
        const now = moment().tz(this.timezone);
        let nextActionTime = now.clone().set({
            hour: targetHour,
            minute: targetMinute,
            second: 0,
            millisecond: 0,
        });

        if (nextActionTime.isBefore(now)) {
            nextActionTime.add(1, 'day');
        }

        return moment.duration(nextActionTime.diff(now));
    }
}

module.exports = TimeManager;