/*const chronosConfig = require('../../../config/chronosConfig');
const eventsConfig = require('../../../config/metro/events.json');
const moment = require('moment-timezone');
const logger = require('../../../events/logger');

class StatusConfig {
  constructor() {
    this.TIMEZONE = 'America/Santiago';
    this.validateConfigs();
    this.initializeStatusCodes();
    this.initializeEventHandlers();
  }

  validateConfigs() {
    const requiredScheduleFields = ['weekday', 'saturday', 'sunday'];
    if (!requiredScheduleFields.every(field => chronosConfig?.schedule?.[field])) {
      throw new Error('Missing required schedule configuration in chronosConfig');
    }

    if (!Array.isArray(eventsConfig.events)) {
      throw new Error('events.json must contain an "events" array');
    }

    logger.debug('CONFIG_VALIDATION', 'All required configurations validated');
  }

  initializeStatusCodes() {
    this.STATUS_CODES = {
      0: { 
        name: 'overnight', 
        emoji: '🌙', 
        color: '#3498db',
        description: 'Servicio nocturno reducido',
        priority: 1
      },
      1: { 
        name: 'operational', 
        emoji: '🟢', 
        color: '#2ecc71',
        description: 'Operación normal',
        priority: 3
      },
      2: { 
        name: 'closed', 
        emoji: '⛔', 
        color: '#95a5a6',
        description: 'Fuera de horario de servicio',
        priority: 0
      },
      3: { 
        name: 'partial', 
        emoji: '🟡', 
        color: '#f39c12',
        description: 'Servicio parcial',
        priority: 2
      },
      4: { 
        name: 'delayed', 
        emoji: '⚠️', 
        color: '#e67e22',
        description: 'Servicio con demoras',
        priority: 2
      },
      5: { 
        name: 'extended', 
        emoji: '🌙➕', 
        color: '#9b59b6',
        description: 'Horario extendido por evento',
        priority: 4
      }
    };

    this.STATUS_PRIORITY_MAP = Object.entries(this.STATUS_CODES)
      .sort(([,a], [,b]) => b.priority - a.priority)
      .reduce((acc, [code, data]) => {
        acc[data.name] = parseInt(code, 10);
        return acc;
      }, {});
  }

  initializeEventHandlers() {
    this.eventListeners = {
      statusChange: []
    };

    process.on('SIGTERM', () => {
      logger.info('CONFIG_SHUTDOWN', 'Received SIGTERM, cleaning up status config');
      this.cleanup();
    });
  }

  onStatusChange(callback) {
    this.eventListeners.statusChange.push(callback);
  }

  emitStatusChange(oldStatus, newStatus) {
    this.eventListeners.statusChange.forEach(cb => cb(oldStatus, newStatus));
  }

  getCurrentStatus(time = moment().tz(this.TIMEZONE)) {
    const statusChecks = [
      this.checkEventStatus(time),
      this.checkScheduleStatus(time)
    ];

    // Get highest priority status
    const currentStatus = statusChecks.reduce((prev, current) => 
      (prev.priority > current.priority) ? prev : current
    );

    logger.debug('CURRENT_STATUS', {
      status: currentStatus.name,
      code: currentStatus.code,
      reason: currentStatus.reason
    });

    return currentStatus;
  }

  checkEventStatus(time) {
    const activeEvent = this.getActiveEvent(time);
    if (activeEvent) {
      return {
        ...this.STATUS_CODES[5],
        code: 5,
        reason: `Horario extendido por ${activeEvent.name}`,
        event: activeEvent
      };
    }
    return { ...this.STATUS_CODES[1], priority: -1 }; // Default fallback
  }

  checkScheduleStatus(time) {
    if (this.isOvernight(time)) {
      return { ...this.STATUS_CODES[0], reason: 'Horario nocturno' };
    }
    if (this.isClosed(time)) {
      return { ...this.STATUS_CODES[2], reason: 'Fuera de horario' };
    }
    if (this.isPeakHours(time)) {
      return { ...this.STATUS_CODES[1], reason: 'Horario punta' };
    }
    if (this.isReducedHours(time)) {
      return { ...this.STATUS_CODES[3], reason: 'Horario valle' };
    }
    return { ...this.STATUS_CODES[1], reason: 'Horario normal' };
  }

  getActiveEvent(time) {
    try {
      const activeEvent = eventsConfig.events.find(event => {
        if (!this.validateEvent(event)) return false;

        const eventDate = moment.tz(event.date, 'YYYY-MM-DD', this.TIMEZONE);
        const start = moment.tz(`${event.date} ${event.extendedHours.start}`, 'YYYY-MM-DD HH:mm', this.TIMEZONE);
        const end = moment.tz(`${event.date} ${event.extendedHours.end}`, 'YYYY-MM-DD HH:mm', this.TIMEZONE);

        return time.isBetween(start, end, null, '[]');
      });

      if (activeEvent) {
        logger.info('ACTIVE_EVENT_DETECTED', {
          event: activeEvent.name,
          start: activeEvent.extendedHours.start,
          end: activeEvent.extendedHours.end
        });
      }

      return activeEvent || null;
    } catch (error) {
      logger.error('EVENT_PROCESSING_ERROR', error);
      return null;
    }
  }

  validateEvent(event) {
    if (!event.date || !event.extendedHours) {
      logger.warn('INVALID_EVENT_FORMAT', `Event missing required fields: ${event.name || 'unnamed'}`);
      return false;
    }

    const dateValid = moment.tz(event.date, 'YYYY-MM-DD', this.TIMEZONE).isValid();
    if (!dateValid) {
      logger.warn('INVALID_EVENT_DATE', `Invalid date format: ${event.date}`);
      return false;
    }

    return true;
  }

  isServiceHours(time = moment().tz(this.TIMEZONE)) {
    const status = this.getCurrentStatus(time);
    return ![0, 2].includes(status.code);
  }

  isOvernight(time) {
    const [start, end] = chronosConfig.overnightPeriod || ['00:00', '06:00'];
    return this.isTimeBetween(time, start, end);
  }

  isClosed(time) {
    const dayType = this.getDayType(time);
    const [openStr, closeStr] = chronosConfig.schedule[dayType];
    return !this.isTimeBetween(time, openStr, closeStr);
  }

  isPeakHours(time) {
    return chronosConfig.peakPeriods?.some(period => 
      this.isTimeBetween(time, period.start, period.end)
    ) || false;
  }

  isReducedHours(time) {
    return chronosConfig.reducedPeriods?.some(period => 
      this.isTimeBetween(time, period.start, period.end)
    ) || false;
  }

  getDayType(time) {
    if (chronosConfig.festiveDays.includes(time.format('YYYY-MM-DD'))) {
      return 'festive';
    }
    return ['sunday', 'weekday', 'weekday', 'weekday', 'weekday', 'weekday', 'saturday'][time.day()];
  }

  isTimeBetween(time, startStr, endStr) {
    try {
      const start = this.parseTimeString(startStr);
      const end = this.parseTimeString(endStr);
      
      if (start.isAfter(end)) {
        // Handle overnight ranges (e.g., 22:00-06:00)
        return time.isSameOrAfter(start) || time.isSameOrBefore(end);
      }
      return time.isBetween(start, end, null, '[]');
    } catch (error) {
      logger.error('TIME_COMPARISON_FAILED', error);
      return false;
    }
  }

  parseTimeString(timeStr) {
    const [hourStr, minuteStr] = timeStr.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr || '0', 10);

    if (isNaN(hour)) throw new Error(`Invalid hour: ${hourStr}`);
    if (hour < 0 || hour >= 24) throw new Error(`Hour out of range (0-23): ${hour}`);
    if (minute < 0 || minute >= 60) throw new Error(`Minute out of range (0-59): ${minute}`);

    return moment().tz(this.TIMEZONE).set({ hour, minute, second: 0 });
  }

  cleanup() {
    this.eventListeners.statusChange = [];
    logger.info('CONFIG_CLEANUP', 'Status config cleanup complete');
  }

  // Singleton pattern
  static getInstance() {
    if (!StatusConfig.instance) {
      StatusConfig.instance = new StatusConfig();
    }
    return StatusConfig.instance;
  }
}

module.exports = StatusConfig.getInstance();*/