/**
 * @module EventPayload
 * @description Defines a standardized structure for event payloads used throughout the system.
 */

const EventValidator = require('./EventValidator');

/**
 * @class EventPayload
 * @description Represents a standardized event payload, ensuring consistency and providing validation.
 */
class EventPayload {
    /**
     * Creates an instance of EventPayload.
     * @param {string} eventType - The type of the event, should correspond to a value in EventRegistry.
     * @param {object} [data={}] - The event-specific data.
     * @param {object} [metadata={}] - Contextual metadata about the event, such as source or user info.
     */
    constructor(eventType, data = {}, metadata = {}) {
        /** @type {string} */
        this.type = eventType;
        /** @type {string} */
        this.timestamp = new Date().toISOString();
        /** @type {object} */
        this.data = data;
        /** @type {object} */
        this.metadata = {
            source: 'unknown',
            ...metadata,
            eventId: this._generateEventId()
        };
        /** @type {Array<string>} */
        this.errors = [];
        /** @private */
        this._validator = new EventValidator();
    }

    /**
     * Validates the payload against a predefined schema.
     * @returns {boolean} True if the payload is valid, false otherwise. The errors are stored in the `errors` property.
     */
    validate() {
        this.errors = this._validator.validate(this);
        return this.errors.length === 0;
    }

    /**
     * Returns a sanitized version of the data, with sensitive fields removed.
     * @returns {object} A sanitized clone of the data object.
     */
    sanitizedData() {
        const clone = { ...this.data };
        // Remove sensitive fields if present
        if (clone.user) delete clone.user.token;
        if (clone.auth) delete clone.auth.password;
        return clone;
    }

    /**
     * Generates a unique ID for the event.
     * @private
     * @returns {string} A unique event ID.
     */
    _generateEventId() {
        return `${this.timestamp}-${Math.random().toString(36).substr(2, 8)}`;
    }
}

module.exports = EventPayload;
