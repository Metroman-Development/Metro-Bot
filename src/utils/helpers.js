// utils/helpers.js

async function sleep(ms) {

        return new Promise(function(resolve) {

            setTimeout(resolve, ms);

        });

    }

module.exports = {

    /**

     * Async sleep/delay function

     * @param {number} ms - Milliseconds to wait

     * @returns {Promise<void>}

     */



    /**

     * Executes a function with retry logic

     * @param {Function} fn - Async function to execute

     * @param {Object} options - Retry configuration

     * @param {number} options.maxRetries - Maximum attempts (default: 3)

     * @param {number} options.retryDelay - Delay between attempts in ms (default: 1000)

     * @param {Function} [options.shouldRetry] - Custom retry condition (err) => boolean

     * @returns {Promise<any>}

     */

    async retry(fn, options = {}) {

        const {

            maxRetries = 3,

            retryDelay = 1000,

            shouldRetry = function() { return true; }

        } = options;

        let attempt = 0;

        let lastError;

        while (attempt < maxRetries) {

            attempt++;

            try {

                return await fn();

            } catch (error) {

                lastError = error;

                if (!shouldRetry(error) || attempt >= maxRetries) break;

                await sleep(retryDelay);

            }

        }

        throw lastError;

    },


    /**

     * Validates if a value exists in an object/enum

     * @param {object} enumObj - The enum/object to check against

     * @param {*} value - The value to validate

     * @returns {boolean}

     */

    isValidEnumValue: function(enumObj, value) {

        return Object.values(enumObj).includes(value);

    },

    /**

     * Formats a duration in milliseconds to human-readable format

     * @param {number} ms - Duration in milliseconds

     * @returns {string} Formatted string (e.g. "1d 5h 3m")

     */

    formatDuration: function(ms) {

        const seconds = Math.floor(ms / 1000);

        const minutes = Math.floor(seconds / 60);

        const hours = Math.floor(minutes / 60);

        const days = Math.floor(hours / 24);

        return [

            days > 0 ? days + 'd' : null,

            hours % 24 > 0 ? (hours % 24) + 'h' : null,

            minutes % 60 > 0 ? (minutes % 60) + 'm' : null

        ].filter(Boolean).join(' ') || '0m';

    },

    /**

     * Deep clones an object (simple implementation)

     * @param {object} obj - Object to clone

     * @returns {object} Cloned object

     */

    deepClone: function(obj) {

        try {

            return JSON.parse(JSON.stringify(obj));

        } catch (err) {

            console.error('Clone failed:', err);

            return {};

        }

    },

    /**

     * Converts a time string (HH:MM) to minutes since midnight

     * @param {string} timeStr - Time string in HH:MM format

     * @returns {number} Minutes since midnight

     */

    timeToMinutes: function(timeStr) {

        const parts = timeStr.split(':').map(Number);

        return parts[0] * 60 + parts[1];

    },

    /**

     * Checks if current time is within operating hours

     * @param {string} start - Start time (HH:MM)

     * @param {string} end - End time (HH:MM)

     * @param {Date} [now] - Optional current time

     * @returns {boolean}

     */

    isWithinHours: function(start, end, now) {

        if (!now) now = new Date();

        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const startMinutes = this.timeToMinutes(start);

        const endMinutes = this.timeToMinutes(end);



        if (startMinutes <= endMinutes) {

            return currentMinutes >= startMinutes && currentMinutes <= endMinutes;

        } else {

            // Handle overnight ranges (e.g. 22:00-06:00)

            return currentMinutes >= startMinutes || currentMinutes <= endMinutes;

        }

    }

};
