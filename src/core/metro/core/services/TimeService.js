const TimeAwaiter = require('../../../chronos/TimeAwaiter');
const logger = require('../../../../events/logger');

class TimeService {
    constructor(metro) {
        this.metro = metro;
        this.timeAwaiter = new TimeAwaiter(this.metro);
    }

    checkTime() {
        try {
            logger.debug('[TimeService] Checking time...');
            this.timeAwaiter.checkTime(this.metro.api);
        } catch (error) {
            logger.error('[TimeService] Error in checkTime:', error);
        }
    }
}

module.exports = TimeService;
