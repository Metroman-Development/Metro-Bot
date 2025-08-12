const { clearInterval } = require("timers");

/**
 * A generic, in-memory cache manager with Time-To-Live (TTL) support.
 * It automatically cleans up expired entries.
 */
class CacheManager {
    constructor() {
        this.store = new Map();
        // Clean up expired entries every hour.
        this.cleanupInterval = setInterval(() => this.clearExpired(), 3600000);
        console.log('[CacheManager] Initialized with hourly cleanup.');
    }

    /**
     * Sets a value in the cache with a Time-To-Live (TTL).
     * @param {string} key The key to store the data under.
     * @param {*} value The data to store.
     * @param {number} [ttl=300000] The TTL in milliseconds (default: 5 minutes).
     * @returns {string} The key used to store the data.
     */
    set(key, value, ttl = 300000) {
        if (!key) {
            console.error("[CacheManager] Error: Cache key cannot be null or undefined.");
            return;
        }
        const expiration = Date.now() + ttl;
        this.store.set(key, { value, expiration });
        return key;
    }

    /**
     * Retrieves a value from the cache. Returns null if the key doesn't exist or the item has expired.
     * @param {string} key The key to retrieve.
     * @returns {*|null} The cached data or null.
     */
    get(key) {
        const item = this.store.get(key);
        if (!item) return null;

        // Check for expiration
        if (Date.now() > item.expiration) {
            this.store.delete(key);
            console.log(`[CacheManager] Expired item removed for key: ${key}`);
            return null;
        }

        return item.value;
    }

    /**
     * Deletes a value from the cache.
     * @param {string} key The key to delete.
     * @returns {boolean} True if an element in the Map existed and has been removed, or false if the element does not exist.
     */
    delete(key) {
        return this.store.delete(key);
    }

    /**
     * Checks if a key exists in the cache (and is not expired).
     * @param {string} key The key to check.
     * @returns {boolean} True if the key exists and is valid, false otherwise.
     */
    has(key) {
        return this.get(key) !== null;
    }

    /**
     * Clears all expired items from the cache. This is called periodically by the internal timer.
     */
    clearExpired() {
        const now = Date.now();
        let clearedCount = 0;
        for (const [key, { expiration }] of this.store) {
            if (now > expiration) {
                this.store.delete(key);
                clearedCount++;
            }
        }
        if (clearedCount > 0) {
            console.log(`[CacheManager] Cleared ${clearedCount} expired entries during periodic cleanup.`);
        }
    }

    /**
     * Stops the periodic cleanup interval. This should be called on graceful application shutdown
     * to prevent the process from hanging.
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            console.log('[CacheManager] Cleanup interval stopped.');
        }
    }
}

// Export a singleton instance of the CacheManager so state is shared across the application.
module.exports = new CacheManager();
