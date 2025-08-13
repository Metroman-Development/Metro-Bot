// modules/utils/deepFreeze.js
'use strict';

/**
 * Deep freeze any JavaScript value
 * @param {*} object - The object/value to freeze
 * @returns {*} The frozen version of the input
 */
function deepFreeze(object) {
    // Primitive values are already immutable
    if (object === null ||
        typeof object !== 'object' ||
        Object.isFrozen(object)) {
        return object;
    }

    // Handle special cases
    if (object instanceof Date ||
        object instanceof RegExp ||
        object instanceof Map ||
        object instanceof Set ||
        ArrayBuffer.isView(object)) {
        return Object.freeze(object);
    }

    // Recursively freeze all properties
    Object.getOwnPropertyNames(object).forEach(name => {
        const prop = object[name];

        // Freeze properties recursively
        if (prop && typeof prop === 'object' && !Object.isFrozen(prop)) {
            deepFreeze(prop);
        }
    });

    // Freeze non-enumerable symbols
    Object.getOwnPropertySymbols(object).forEach(sym => {
        const prop = object[sym];
        if (prop && typeof prop === 'object' && !Object.isFrozen(prop)) {
            deepFreeze(prop);
        }
    });

    // Freeze the object itself
    try {
        return Object.freeze(object);
    } catch (e) {
        // Handle cases where freezing fails (like with some browser objects)
        if (process.env.NODE_ENV !== 'production') {
            console.warn('Failed to freeze object:', object, e);
        }
        return object;
    }
}

/**
 * Version that throws errors on modification attempts
 */
deepFreeze.hard = function hardFreeze(object) {
    const handler = {
        get(target, prop) {
            const value = Reflect.get(target, prop);
            return typeof value === 'object' ? hardFreeze(value) : value;
        },
        set() {
            throw new Error('Object is frozen - modification prohibited');
        },
        deleteProperty() {
            throw new Error('Object is frozen - deletion prohibited');
        },
        defineProperty() {
            throw new Error('Object is frozen - property definition prohibited');
        }
    };

    // First do a normal deep freeze
    const frozen = deepFreeze(object);

    // Then add strict proxy wrapper
    return new Proxy(frozen, handler);
};

/**
 * Check if an object is deeply frozen
 */
deepFreeze.isFrozen = function isDeeplyFrozen(object) {
    if (object === null || typeof object !== 'object') {
        return true;
    }

    if (!Object.isFrozen(object)) {
        return false;
    }

    return Object.getOwnPropertyNames(object)
        .concat(Object.getOwnPropertySymbols(object))
        .every(prop => {
            const value = object[prop];
            return typeof value !== 'object' || isDeeplyFrozen(value);
        });
};

module.exports = deepFreeze;