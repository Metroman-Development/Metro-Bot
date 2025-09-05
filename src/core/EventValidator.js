// core/EventValidator.js
const EventRegistry = require('./EventRegistry');
const { performance } = require('perf_hooks');

class EventValidator {
    constructor() {
        this.schemas = {

            // ... existing schemas ...

            // ======================
            // TIME-BASED EVENTS
            // ======================
            [EventRegistry.DAY_TYPE_CHANGE]: {
                required: ['dayType', 'nextTransition'],
                dayType: {
                    type: 'string',
                    enum: ['weekday', 'saturday', 'sunday', 'festive']
                },
                nextTransition: {
                    type: 'object',
                    required: ['time', 'type'],
                    time: { type: 'string', pattern: /^\d{2}:\d{2}$/ },
                    type: { type: 'string' }
                }
            },

            [EventRegistry.SERVICE_TRANSITION]: {
                required: ['type', 'opening', 'closing'],
                type: { type: 'string', enum: ['normal', 'extended', 'special'] },
                opening: { type: 'string', pattern: /^\d{2}:\d{2}$/ },
                closing: { type: 'string', pattern: /^\d{2}:\d{2}$/ },
                eventName: { type: 'string', optional: true }
            },

            [EventRegistry.EXPRESS_CHANGE]: {
                required: ['active', 'period'],
                active: { type: 'boolean' },
                period: {
                    type: 'object',
                    required: ['type', 'name'],
                    type: { type: 'string', enum: ['PUNTA', 'VALLE', 'NOCHE'] },
                    name: { type: 'string' }
                }
            },

            [EventRegistry.FARE_PERIOD_CHANGE]: {
                required: ['periodType', 'name'],
                periodType: {
                    type: 'string',
                    enum: ['morning_peak', 'evening_peak', 'off_peak', 'night']
                },
                name: { type: 'string' }
            },




            // ======================
            // CORE SYSTEM EVENTS
            // ======================
            [EventRegistry.SYSTEM_READY]: {
                required: ['version', 'startupTime'],
                version: { type: 'string', pattern: /^\d+\.\d+\.\d+$/ },
                startupTime: { type: 'number', min: 0 }
            },

            [EventRegistry.FATAL_ERROR]: {
                required: ['error', 'component'],
                error: {
                    type: 'object',
                    required: ['message', 'stack'],
                    message: { type: 'string', minLength: 1 },
                    stack: { type: 'string' }
                },
                component: { type: 'string', enum: ['core', 'api', 'db', 'scheduler'] }
            },

            // ======================
            // DATA FLOW EVENTS
            // ======================
            [EventRegistry.DATA_UPDATED]: {
                required: ['version', 'stations', 'lines', 'network'],
                version: { type: 'string', minLength: 10 },
                stations: {
                    type: 'object',
                    validate: (stations) => Object.values(stations).every(s =>
                        s.id && s.name && (typeof s.status === 'string' || (typeof s.status === 'object' && s.status.code !== undefined)))
                },
                lines: {
                    type: 'object',
                    validate: (lines) => Object.values(lines).every(l =>
                        l.id && l.displayName && (typeof l.status === 'string' || (typeof l.status === 'object' && l.status.code !== undefined)))
                },
                network: {
                    type: 'object',
                    required: ['status', 'timestamp'],
                    status: { type: 'string', enum: ['operational', 'degraded', 'outage'] }
                }
            },

            // ======================
            // POLLING EVENTS
            // ======================
            [EventRegistry.POLL_SUCCESS]: {
                required: ['duration', 'dataVersion'],
                duration: { type: 'number', min: 0, max: 30000 },
                dataVersion: { type: 'string' },
                requestId: { type: 'number', optional: true }
            },

            [EventRegistry.POLL_FAILURE]: {
                required: ['error', 'consecutiveFailures'],
                error: { type: 'object', required: ['message'] },
                consecutiveFailures: { type: 'number', min: 1 },
                retryIn: { type: 'number', min: 1000 }
            },

            // ======================
            // EMBED EVENTS
            // ======================
            [EventRegistry.EMBED_GENERATED]: {
                required: ['success', 'generationTime'],
                success: { type: 'boolean' },
                generationTime: { type: 'number', min: 0 },
                embedStats: {
                    type: 'object',
                    optional: true,
                    fields: { type: 'number', min: 1 },
                    linesTracked: { type: 'number', min: 0 }
                },
                error: {
                    type: 'object',
                    optional: true,
                    required: ['message']
                }
            },

            // ======================
            // ENTITY STATUS EVENTS
            // ======================
            [EventRegistry.LINE_STATUS_CHANGED]: {
                required: ['lineId', 'from', 'to'],
                lineId: { type: 'string', pattern: /^[a-z_]+$/ },
                from: { type: 'string', enum: ['operational', 'delayed', 'suspended'] },
                to: { type: 'string', enum: ['operational', 'delayed', 'suspended'] },
                affectedStations: { type: 'number', min: 0, optional: true }
            },

            [EventRegistry.ENTITY_NOT_FOUND]: {
                required: ['entityType', 'entityId'],
                entityType: { type: 'string', enum: ['station', 'line'] },
                entityId: { type: 'string', minLength: 1 }
            },

            // ======================
            // CHANGE DETECTION
            // ======================
            [EventRegistry.CHANGES_DETECTED]: {
                required: ['changes', 'metadata'],
                changes: {
                    type: 'array',
                    validate: (changes) => changes.every(c =>
                        c.id && c.type && c.from && c.to)
                },
                metadata: {
                    required: ['severity'],
                    severity: {
                        type: 'string',
                        enum: ['critical', 'high', 'medium', 'low', 'none']
                    },
                    groupedStations: {
                        type: 'array',
                        optional: true
                    }
                }
            },

            // ======================
            // DATABASE EVENTS
            // ======================
            [EventRegistry.DB_QUERY]: {
                required: ['query', 'duration'],
                query: { type: 'string', minLength: 1 },
                duration: { type: 'number', min: 0 },
                rows: { type: 'number', optional: true }
            }
        };

        // Custom validator functions
        this.validators = {
            duration: (value) => {
                const now = performance.now();
                return value >= 0 && value < now;
            },
            entityId: (value, entityType) => {
                const patterns = {
                    station: /^[a-z]+_[a-z]+$/,
                    line: /^[a-z]+_line$/
                };
                return patterns[entityType].test(value);
            }
        };
    }

    /**
     * Validate an event payload against its schema
     * @param {EventPayload} payload
     * @returns {Array} List of validation errors
     */
    validate(payload) {
        const errors = [];
        const schema = this.schemas[payload.type];

        if (!schema) {
            return []; // No schema = no validation
        }

        this._validateObject(payload.data, schema, errors);

        return errors;
    }

    _validateObject(data, schema, errors, prefix = '') {
        // 1. Check required fields
        if (schema.required) {
            schema.required.forEach(field => {
                if (data[field] === undefined) {
                    errors.push(`Missing required field: '${prefix}${field}'`);
                }
            });
        }

        // 2. Validate field types and constraints
        for (const [field, rules] of Object.entries(schema)) {
            if (field === 'required') continue;

            const value = data[field];
            if (value === undefined) continue;

            const fieldName = `${prefix}${field}`;

            // Type checking
            if (rules.type && typeof value !== rules.type) {
                errors.push(`Invalid type for '${fieldName}'. Expected ${rules.type}, got ${typeof value}`);
                continue; // Skip other checks if type is wrong
            }

            // Custom validators
            if (this.validators[field]) {
                if (!this.validators[field](value, data)) {
                    errors.push(`Custom validation failed for '${fieldName}'`);
                }
            }

            // String constraints
            if (typeof value === 'string') {
                if (rules.minLength !== undefined && value.length < rules.minLength) {
                    errors.push(`'${fieldName}' must be at least ${rules.minLength} characters long.`);
                }
                if (rules.pattern && !rules.pattern.test(value)) {
                    errors.push(`'${fieldName}' does not match the required pattern.`);
                }
                if (rules.enum && !rules.enum.includes(value)) {
                    errors.push(`'${fieldName}' has an invalid value. Must be one of: ${rules.enum.join(', ')}`);
                }
            }

            // Number constraints
            if (typeof value === 'number') {
                if (rules.min !== undefined && value < rules.min) {
                    errors.push(`'${fieldName}' must be at least ${rules.min}.`);
                }
                if (rules.max !== undefined && value > rules.max) {
                    errors.push(`'${fieldName}' must be no more than ${rules.max}.`);
                }
            }

            // Nested object validation
            if (rules.type === 'object' && !rules.validate) {
                this._validateObject(value, rules, errors, `${fieldName}.`);
            }


            // Object validation
            if (rules.validate && typeof rules.validate === 'function') {
                try {
                    if (!rules.validate(value)) {
                        errors.push(`Validation failed for object '${fieldName}'`);
                    }
                } catch (error) {
                    errors.push(`Error during validation for '${fieldName}': ${error.message}`);
                }
            }
        }
    }

    /**
     * Validate and sanitize an event type
     * @param {string} eventType
     * @returns {string|null}
     */
    validateEventType(eventType) {
        if (!Object.values(EventRegistry).includes(eventType)) {
            return null;
        }
        return eventType;
    }
}

module.exports = EventValidator;
