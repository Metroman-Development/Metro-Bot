// modules/metro/core/internal/ScheduleEngine.js
const EventRegistry = require('../../../../core/EventRegistry');
const EventPayload = require('../../../../core/EventPayload');
const logger = require('../../../../events/logger');

module.exports = class ScheduleEngine {
    constructor(metro) {
        this.metro = metro;
        this._pollingState = null;
    }

    initialize() {
        if (!this.metro.client) throw new Error("Client not available");
        
        this.metro._scheduler = new (require('../../../chronos/ScheduleManager'))(
            this.metro.client, 
            {}, 
            this.metro
        );

        return this.metro._scheduler.initialize().then(() => {
            this.metro._scheduler
                .on(EventRegistry.SERVICE_TRANSITION, (data) => {
                    this.handleServiceTransition(data);
                })
                .on(EventRegistry.EXPRESS_CHANGE, (data) => {
                    this.handleExpressChange(data);
                });

            logger.debug('[ScheduleEngine] Initialized');
        });
    }

    startPolling(interval = 60000) {
        const validatedInterval = Math.max(30000, parseInt(interval));
        if (isNaN(validatedInterval)) {
            throw new Error(`Invalid polling interval: ${interval}`);
        }

        if (this.metro._pollingInterval) {
            clearInterval(this.metro._pollingInterval);
        }

        this._pollingState = {
            interval: validatedInterval,
            lastSuccess: null,
            consecutiveFailures: 0,
            totalRequests: 0
        };

        const poll = async () => {
            const startTime = Date.now();
            this._pollingState.totalRequests++;

            try {
                const data = await this.metro._subsystems.api.fetchNetworkStatus();
                this._pollingState.lastSuccess = new Date();
                this._pollingState.consecutiveFailures = 0;

                this.metro.emit(EventRegistry.POLL_SUCCESS, 
                    new EventPayload(
                        EventRegistry.POLL_SUCCESS,
                        {
                            duration: Date.now() - startTime,
                            dataVersion: data.version
                        },
                        { 
                            source: 'PollingSystem',
                            requestId: this._pollingState.totalRequests
                        }
                    )
                );

            } catch (error) {
                this._pollingState.consecutiveFailures++;
                const backoffDelay = this._calculateBackoff();
                
                logger.error(`Polling failed (attempt ${this._pollingState.consecutiveFailures})`, {
                    error: error.message,
                    nextAttempt: `${backoffDelay}ms`
                });

                this.metro.emit(EventRegistry.POLL_FAILURE,
                    new EventPayload(
                        EventRegistry.POLL_FAILURE,
                        {
                            error,
                            consecutiveFailures: this._pollingState.consecutiveFailures,
                            retryIn: backoffDelay
                        },
                        { 
                            source: 'PollingSystem',
                            critical: this._pollingState.consecutiveFailures > 3
                        }
                    )
                );

                clearInterval(this.metro._pollingInterval);
                this.metro._pollingInterval = setTimeout(poll, backoffDelay);
                return;
            }

            if (this.metro._pollingInterval._idleTimeout !== validatedInterval) {
                clearInterval(this.metro._pollingInterval);
                this.metro._pollingInterval = setInterval(poll, validatedInterval);
            }
        };

        this.metro._pollingInterval = setInterval(poll, validatedInterval);
        process.nextTick(poll);

        logger.info(`Polling started (${validatedInterval}ms interval)`);

        return {
            stop: () => {
                clearInterval(this.metro._pollingInterval);
                this.metro._pollingInterval = null;
                logger.info('Polling stopped');
            },
            getStatus: () => ({
                ...this._pollingState,
                isActive: !!this.metro._pollingInterval,
                nextPoll: this.metro._pollingInterval 
                    ? Date.now() + this.metro._pollingInterval._idleTimeout 
                    : null
            }),
            forcePoll: () => {
                if (this.metro._pollingInterval) {
                    clearInterval(this.metro._pollingInterval);
                    this.metro._pollingInterval = setInterval(poll, validatedInterval);
                    process.nextTick(poll);
                    return true;
                }
                return false;
            }
        };
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

    _calculateBackoff() {
        const baseDelay = Math.min(
            300000,
            Math.pow(2, this._pollingState.consecutiveFailures) * 1000
        );
        return baseDelay + (Math.random() * 2000);
    }

    _calculateCurrentLoad() {
        // Implementation would use real load metrics
        return Math.floor(Math.random() * 100);
    }
};