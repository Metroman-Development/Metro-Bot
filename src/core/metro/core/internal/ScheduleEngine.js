const EventRegistry = require('../../../../core/EventRegistry');
const EventPayload = require('../../../../core/EventPayload');
const logger = require('../../../../events/logger');

module.exports = class ScheduleEngine {
    constructor(metro) {
        this.metro = metro;
    }

    initialize() {
        if (!this.metro.client) {
            console.warn("Client not available for ScheduleEngine.");
        }
        // Initialization logic for scheduling can be added here in the future.
    }

    handleServiceTransition(data) {
        const helpers = this.metro._subsystems.utils.scheduleHelpers;
        this.metro.emit(EventRegistry.SERVICE_CHANGE,
            new EventPayload(
                EventRegistry.SERVICE_CHANGE,
                {
                    ...data,
                    systemState: {
                        period: helpers.getCurrentPeriod(),
                        dayType: helpers.getCurrentDayType(),
                        isExpressActive: helpers.shouldRunExpress(),
                        nextTransition: helpers.getUpcomingTransitions()[0] || null
                    }
                },
                { source: 'ScheduleManager' }
            )
        );
    }

    handleExpressChange(data) {
        this.metro.emit(EventRegistry.EXPRESS_UPDATE,
            new EventPayload(
                EventRegistry.EXPRESS_UPDATE,
                {
                    ...data,
                    context: {
                        affectedLines: this.metro.config.expressLines,
                        currentLoad: this._calculateCurrentLoad()
                    }
                },
                { source: 'ScheduleManager' }
            )
        );
    }

    _calculateCurrentLoad() {
        return Math.floor(Math.random() * 100);
    }
};
