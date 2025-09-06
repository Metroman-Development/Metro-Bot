// core/EventPayload.js

const EventValidator = require('./EventValidator');
const TimeHelpers = require('../utils/timeHelpers');

class EventPayload {
    /**
     * Standardized event payload structure
     * @param {string} eventType - From EventRegistry
     * @param {object} data - Event-specific data
     * @param {object} metadata - Contextual metadata
     */
    constructor(eventType, data = {}, metadata = {}) {
        this.type = eventType;
        this.timestamp = new TimeHelpers().currentTime.toISOString();
        this.data = data;
        this.metadata = {
            source: 'unknown',
            ...metadata,
            eventId: this._generateEventId()
        };
        this.errors = [];
        this._validator = new EventValidator();
    }

    /**
     * Validate payload structure
     */
    validate() {
        this.errors = this._validator.validate(this);
        return this.errors.length === 0;
    }

    /**
     * Get sanitized data for logging
     */
    sanitizedData() {
        const clone = { ...this.data };
        // Remove sensitive fields if present
        if (clone.user) delete clone.user.token;
        if (clone.auth) delete clone.auth.password;
        return clone;
    }

    _generateEventId() {
        return `${this.timestamp}-${Math.random().toString(36).substr(2, 8)}`;
    }
}

module.exports = EventPayload;