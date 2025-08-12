/**
 * @module EventTracer
 * @description Provides a singleton class for tracing and collecting statistics on system events.
 */

const EventRegistry = require('./EventRegistry');
const logger = require('../events/logger');

/**
 * @class EventTracer
 * @description A singleton class to track events, log them, and provide statistics.
 */
class EventTracer {
    constructor() {
        /** @type {Array<object>} */
        this.eventLog = [];
        /** @type {object} */
        this.stats = {
            eventsProcessed: 0,
            lastMinute: 0,
            byType: new Map()
        };

        this._setupCleanupInterval();
    }

    /**
     * Tracks an event, adding it to the log and updating statistics.
     * @param {object} event - The event payload to track.
     * @returns {{payload: object, startTimer: function(): void, endTimer: function(): void}} An object with the event payload and timer functions.
     */
    track(event) {
        const entry = {
            timestamp: Date.now(),
            type: event.type,
            source: event.metadata?.source || 'unknown',
            processingTime: 0
        };

        // Add to log (limit to 1000 entries)
        this.eventLog.push(entry);
        if (this.eventLog.length > 1000) {
            this.eventLog.shift();
        }

        // Update statistics
        this.stats.eventsProcessed++;
        this.stats.lastMinute++;

        const typeCount = this.stats.byType.get(event.type) || 0;
        this.stats.byType.set(event.type, typeCount + 1);

        return {
            payload: event,
            /**
             * Starts a timer to measure the processing time of the event.
             */
            startTimer: () => {
                entry.startTime = performance.now();
            },
            /**
             * Ends the timer and records the processing time.
             */
            endTimer: () => {
                if (entry.startTime) {
                    entry.processingTime = performance.now() - entry.startTime;
                    event.processingTime = entry.processingTime;
                }
            }
        };
    }

    /**
     * Retrieves the current event statistics.
     * @returns {{total: number, lastMinute: number, byType: object}} An object containing event statistics.
     */
    getStats() {
        return {
            total: this.stats.eventsProcessed,
            lastMinute: this.stats.lastMinute,
            byType: Object.fromEntries(this.stats.byType.entries())
        };
    }

    /**
     * Sets up a cleanup interval to reset the last minute event count and trim the event log.
     * @private
     */
    _setupCleanupInterval() {
        setInterval(() => {
            this.stats.lastMinute = 0;
            // Trim old events (older than 1 hour)
            const cutoff = Date.now() - 3600000;
            this.eventLog = this.eventLog.filter(e => e.timestamp > cutoff);
        }, 60000).unref();
    }
}

// Export a singleton instance of EventTracer
module.exports = new EventTracer();
