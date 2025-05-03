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
        const nextDate = moment().tz(this.timezone)
            .set({ hour: targetHour, minute: targetMinute, second: 0 })
            .add(targetHour <= moment().hour() ? 1 : 0, 'days');
            
        return moment.duration(nextDate.diff(moment().tz(this.timezone)));
    }
}

module.exports = TimeManager;