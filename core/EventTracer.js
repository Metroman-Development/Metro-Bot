// core/EventTracer.js
// core/EventTracer.js
const EventRegistry = require('./EventRegistry');
const logger = require('../events/logger');

class EventTracer {
    constructor() {
        this.eventLog = [];
        this.stats = {
            eventsProcessed: 0,
            lastMinute: 0,
            byType: new Map()
        };
        
        this._setupCleanupInterval();
    }

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
            startTimer: () => {
                entry.startTime = performance.now();
            },
            endTimer: () => {
                if (entry.startTime) {
                    entry.processingTime = performance.now() - entry.startTime;
                    event.processingTime = entry.processingTime;
                }
            }
        };
    }

    getStats() {
        return {
            total: this.stats.eventsProcessed,
            lastMinute: this.stats.lastMinute,
            byType: Object.fromEntries(this.stats.byType.entries())
        };
    }

    _setupCleanupInterval() {
        setInterval(() => {
            this.stats.lastMinute = 0;
            // Trim old events (older than 1 hour)
            const cutoff = Date.now() - 3600000;
            this.eventLog = this.eventLog.filter(e => e.timestamp > cutoff);
        }, 60000).unref();
    }
}

// Export both the class and a singleton instance
module.exports = 
    new EventTracer();

