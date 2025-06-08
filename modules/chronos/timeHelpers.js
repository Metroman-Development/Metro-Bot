// modules/chronos/timeHelpers.js

// modules/chronos/timeHelpers.js
// modules/chronos/timeHelpers.js
// modules/chronos/utils/timeHelpers.js
// modules/chronos/utils/timeHelpers.js// modules/chronos/timeHelpers.js
// modules/chronos/timeHelpers.js
const moment = require('moment-timezone');
const chronosConfig = require('../../config/chronosConfig');
const eventsData = require('../../config/metro/events.json');

class TimeHelpers {
    constructor() {
        this.config = chronosConfig;
        this._timezone = chronosConfig.timezone || 'America/Santiago';
        this._currentTime = moment().tz(this._timezone);
        this.events = eventsData.events || [];
        this.validateEventData();
    }

    /**
     * Formats milliseconds into a human-readable duration string
     * @param {number} ms - Duration in milliseconds
     * @param {object} [options] - Formatting options
     * @param {boolean} [options.compact=false] - Use compact format (e.g., "1h5m" instead of "1 hour 5 minutes")
     * @param {number} [options.precision=2] - Number of time units to include
     * @returns {string} Formatted duration string
     */
    formatDuration(ms, options = {}) {
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

    // Configuration validation
    validateEventData() {
        this.events.forEach(event => {
            if (!event.date || !moment(event.date, 'YYYY-MM-DD').isValid()) {
                throw new Error(`Invalid event date: ${event.date}`);
            }

            if (event.extendedHours) {
                if (event.extendedHours.opening && !this.isValidTimeString(event.extendedHours.opening)) {
                    throw new Error(`Invalid opening time format in event: ${event.name}`);
                }
                if (event.extendedHours.closing && !this.isValidTimeString(event.extendedHours.closing)) {
                    throw new Error(`Invalid closing time format in event: ${event.name}`);
                }
            }

            if (event.outStations && typeof event.outStations !== 'object') {
                throw new Error(`outStations must be an object in event: ${event.name}`);
            }
        });
    }

    // Getters and setters
    get timezone() {
        return this._timezone;
    }

    set timezone(tz) {
        if (!moment.tz.zone(tz)) {
            throw new Error(`Invalid timezone: ${tz}`);
        }
        this._timezone = tz;
        this._currentTime.tz(tz);
    }

    get currentTime() {
        this._currentTime = moment().tz(this._timezone);
        return this._currentTime;
    }

    set currentTime(time) {
        const newTime = moment(time).tz(this._timezone);
        if (!newTime.isValid()) {
            throw new Error('Invalid time value');
        }
        this._currentTime = newTime;
    }

    // Core methods
    isValidTimeString(timeStr) {
        return moment(timeStr, 'HH:mm:ss', true).isValid() || 
               moment(timeStr, 'HH:mm', true).isValid();
    }

    get currentDay() {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        return days[this._currentTime.day()];
    }

    getDayType() {
        if (this.isFestiveDay()) return 'festive';
        return this._currentTime.day() === 0 ? 'sunday' :
               this._currentTime.day() === 6 ? 'saturday' : 'weekday';
    }

    isFestiveDay(date = this._currentTime.format('YYYY-MM-DD')) {
        return chronosConfig.festiveDays.includes(date);
    }

    // Event handling
    getCurrentEvent() {
        const today = this._currentTime.format('YYYY-MM-DD');
        return this.events.find(event => event.date === today) || null;
    }

    getEventDetails() {
        const event = this.getCurrentEvent();
        if (!event) return null;

        const normalHours = this.getOperatingHours();
        
        return {
            name: event.name,
            date: event.date,
            active: this.isEventActive(),
            affectedLines: event.outStations ? Object.keys(event.outStations) : [],
            closedStations: event.outStations || {},
            operationalStations: event.inStations || [],
            extendedHours: event.extendedHours || null,
            normalHours: {
                opening: normalHours.opening,
                closing: normalHours.closing
            },
            notes: event.notes || '',
            endTime: event.extendedHours?.closing || normalHours.closing
        };
    }

    isEventActive() {
    const event = this.getCurrentEvent();
    if (!event) return false;

    const eventDate = moment(event.date).tz(this._timezone);
    const prevDate = eventDate.clone().subtract(1, 'day');
    
    const startTimeStr = event.startTime || this.getOperatingHours(prevDate).closing;
    const eventStart = moment(`${event.date} ${startTimeStr}`).tz(this._timezone);
    
    const endTimeStr = event.endTime || this.getOperatingHours(eventDate).closing;
    let eventEnd = moment(`${event.date} ${endTimeStr}`).tz(this._timezone);
    
    // Handle midnight crossing
    if (eventEnd.isBefore(eventStart)) {
        eventEnd.add(1, 'day');
    }

    return this._currentTime.isBetween(eventStart, eventEnd, null, '[]');
}

    getExtendedHours() {
        const event = this.getCurrentEvent();
        return event?.extendedHours || null;
    }

    // Schedule operations
    getOperatingHours() {
        const dayType = this.getDayType();
        const event = this.getCurrentEvent();
        
        const defaultHours = chronosConfig.serviceHours[dayType] || 
                           { start: '06:00', end: '23:00' };

        return {
            opening: defaultHours.start,
            closing: defaultHours.end,
            isExtended: !!event?.extendedHours,
            eventName: event?.name || null,
            extension: [
                event?.extendedHours?.opening || defaultHours.start,
                event?.extendedHours?.closing || defaultHours.end
            ],
            eventNotes: event?.notes || null
        };
    }

    // Station status checks
    getClosedStations(lineId = null) {
        const event = this.getCurrentEvent();
        if (!event || !event.outStations) return [];

        if (lineId) {
            return event.outStations[lineId] || [];
        }
        
        return Object.values(event.outStations).flat();
    }

    isStationClosed(stationId, lineId = null) {
        const closedStations = this.getClosedStations(lineId);
        return closedStations.includes(stationId);
    }

    // Metro specific functions
    isExpressActive() {

        
        if (!this.isWeekday()) return false;
        
        const expressTime = this.config.expressHours 
        
        return this.isTimeBetween(this.currentTime, expressTime.morning.start, expressTime.morning.end ) || this.isTimeBetween(this.currentTime, expressTime.evening.start, expressTime.evening.end ); 
    }

    isWeekday() {

        console.log(this._currentTime.day() !== 0 && 
               this._currentTime.day() !== 6 && 
               !this.isFestiveDay())  
        return this._currentTime.day() !== 0 && 
               this._currentTime.day() !== 6 && 
               !this.isFestiveDay();
    }

    // Utility methods
    formatTime(timeInput, format = 'HH:mm') {
        if (typeof timeInput === 'string' && this.isValidTimeString(timeInput)) {
            return timeInput;
        }
        
        const timeObj = moment(timeInput).tz(this._timezone);
        return timeObj.isValid() ? timeObj.format(format) : '--:--';
    }

    formatDateTime(timestamp, format = 'DD/MM/YYYY HH:mm') {
        const dateObj = moment(timestamp).tz(this._timezone);
        return dateObj.isValid() ? dateObj.format(format) : 'Fecha desconocida';
    }

    formatForEmbed() {
        return this._currentTime.format('HH:mm');
    }

    isTimeBetween(momentTime, startStr, endStr) {
    if (!momentTime || !momentTime.isValid()) {
        throw new Error('Invalid momentTime provided');
    }
    if (!this.isValidTimeString(startStr) || !this.isValidTimeString(endStr)) {
        throw new Error('Invalid time string format. Use HH:mm');
    }

    const format = 'HH:mm';
    const current = momentTime.clone().tz(this._timezone);
    
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

    isWithinOperatingHours() {
        const operatingHours = this.getOperatingHours();
        return this.isTimeBetween(
            this.currentTime,
            operatingHours.opening,
            operatingHours.closing
        );
    }

    // Complete status information
    getServiceStatus() {
        const translatedDay = {
            "sunday": "Domingo",
            "monday": "Lunes",
            "tuesday": "Martes",
            "wednesday": "Miércoles",
            "thursday": "Jueves", 
            "friday": "viernes", 
            "saturday": "Sábado" 
        };
        
        return {
            time: this.formatForEmbed(),
            currentDay: translatedDay[this.currentDay],   
            dayType: this.getDayType().charAt(0).toUpperCase() + this.getDayType().slice(1),
            period: this.getCurrentPeriod(),
            operatingHours: this.getOperatingHours(),
            expressActive: this.isExpressActive(),
            event: this.getEventDetails(),
            nextTransition: this.getNextTransition()
        };
    }

    getTimeStatus() {
        return this.getServiceStatus();
    }

getCurrentPeriod() {
    // First check if we're in extended hours
    const event = this.getCurrentEvent();
    if (event?.extendedHours) {
        const operatingHours = this.getOperatingHours();
        const now = this._currentTime;

        console.log(operatingHours) 
        // Create moments for comparison
        const closingTime = moment(event.extendedHours.closing, 'HH:mm');
        const operatingEnd = moment(operatingHours.closing, 'HH:mm');

        console.log("Jwj", closingTime) 
        console.log(operatingEnd) 
        
        // Handle midnight crossing
        let isExtendedHours;
        if (closingTime.isBefore(operatingEnd)) {
            // Crosses midnight (e.g. 23:30 → 01:00)
            isExtendedHours = now.isSameOrAfter(operatingEnd) || 
                            now.isBefore(closingTime);
        } else {
            // Normal case (e.g. 23:30 → 00:30)
            isExtendedHours = now.isSameOrAfter(operatingEnd) && 
                            now.isBefore(closingTime);
        }
        
        if (isExtendedHours) {
            return { type: 'EXTENDED', name: 'Horario Extendido' };
        }
    }

    

    if (!this.isWithinOperatingHours()) {
        return { type: 'NOCHE', name: 'Fuera de Servicio' };
    }

    const currentTime = this._currentTime;
    
    // Check periods in order of priority
    if (this.isWeekday()) {
        // Check PUNTA first (only on weekdays)
        const isPunta = (chronosConfig.farePeriods?.PUNTA || []).some(period => 
            this.isTimeBetween(currentTime, period.start, period.end)
        );
        if (isPunta) return { type: 'PUNTA', name: 'Hora Punta' };
    

         // Finally check BAJO
    const isBajo = (chronosConfig.farePeriods?.BAJO || []).some(period => 
        this.isTimeBetween(currentTime, period.start, period.end)
    );
    if (isBajo) return { type: 'BAJO', name: 'Horario Bajo' };
        
    }    
        
    // Then check VALLE periods
    const isValle = (chronosConfig.farePeriods?.VALLE || []).some(period => 
        this.isTimeBetween(currentTime, period.start, period.end)
    );
    if (isValle) return { type: 'VALLE', name: 'Horario Normal' };



    // Default to VALLE if none matched (shouldn't happen during operating hours)
    return { type: 'VALLE', name: 'Horario Normal' };
}
    
    getNextTransition() {
        const now = this._currentTime;
        const operatingHours = this.getOperatingHours();
        const transitions = [];
        
        if (this.getDayType() === "weekday") {

        // Add fare period transitions
        Object.entries(chronosConfig.farePeriods).forEach(([periodType, periods]) => {
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

    getPeriodStartMessage(periodType) {
        const messages = {
            'PUNTA': 'Inicio hora punta',
            'VALLE': 'Inicio horario normal',
            'BAJO': 'Inicio horario bajo'
        };
        return messages[periodType] || 'Inicio de periodo';
    }

    getPeriodEndMessage(periodType) {
        const messages = {
            'PUNTA': 'Fin hora punta',
            'VALLE': 'Fin horario normal',
            'BAJO': 'Fin horario bajo'
        };
        return messages[periodType] || 'Fin de periodo';
    }

    getNextServiceTransition() {
        const now = this._currentTime;
        const operatingHours = this.getOperatingHours();
        
        if (!this.isWithinOperatingHours()) {
            const nextOpening = moment(operatingHours.opening, 'HH:mm:ss');
            if (now.isBefore(nextOpening)) {
                return nextOpening;
            }
            return nextOpening.add(1, 'day');
        }
        
        return moment(operatingHours.closing, 'HH:mm:ss');
    }

    getNextExpressTransition() {
        const now = this._currentTime;
        const expressHours = chronosConfig.expressHours || {
            morning: { start: '06:00', end: '09:00' },
            evening: { start: '18:00', end: '21:00' }
        };

        const periods = [
            {
                start: moment(expressHours.morning.start, 'HH:mm:ss'),
                end: moment(expressHours.morning.end, 'HH:mm:ss')
            },
            {
                start: moment(expressHours.evening.start, 'HH:mm:ss'),
                end: moment(expressHours.evening.end, 'HH:mm:ss')
            }
        ];

        for (const period of periods) {
            if (now.isBefore(period.start)) {
                return period.start;
            }
            if (now.isBetween(period.start, period.end)) {
                return period.end;
            }
        }

        let nextDay = now.clone().add(1, 'day');
        while (nextDay.day() === 0 || nextDay.day() === 6 || this.isFestiveDay(nextDay.format('YYYY-MM-DD'))) {
            nextDay.add(1, 'day');
        }
        return moment(expressHours.morning.start, 'HH:mm:ss').set({
            year: nextDay.year(),
            month: nextDay.month(),
            date: nextDay.date()
        });
    }

    willBeExtended() {
        const event = this.getCurrentEvent();
        if (!event || !event.extendedHours) return false;
        
        const currentHours = this.getOperatingHours();
        return currentHours.closing !== event.extendedHours.closing;
    }

    willExpressBeActive() {
        const now = this._currentTime;
        const nextTransition = this.getNextExpressTransition();
        const expressHours = chronosConfig.expressHours || {
            morning: { start: '06:00', end: '09:00' },
            evening: { start: '18:00', end: '21:00' }
        };

        const nextTransitionTime = nextTransition.format('HH:mm:ss');
        return nextTransitionTime === expressHours.morning.start || 
               nextTransitionTime === expressHours.evening.start;
    }
}

module.exports = new TimeHelpers();
