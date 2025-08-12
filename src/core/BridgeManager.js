/**
 * @module BridgeManager
 * @description Manages "bridge" data structures within the cache, providing a simple interface for creating, retrieving, and updating them.
 */

const { CacheManager } = require('./cache/CacheManager');

/**
 * @class BridgeManager
 * @description Provides static methods to interact with bridge data in the cache.
 */
class BridgeManager {
    /**
     * Creates a new bridge with initial data.
     * @param {string} bridgeId - The unique identifier for the bridge.
     * @param {object} initialData - The initial data to store in the bridge.
     * @returns {Promise<void>}
     */
    static async create(bridgeId, initialData) {
        await CacheManager.set(`bridge:${bridgeId}`, {
            ...initialData,
            history: []
        });
    }

    /**
     * Retrieves the data for a specific bridge.
     * @param {string} bridgeId - The unique identifier for the bridge.
     * @returns {Promise<object|undefined>} The bridge data, or undefined if not found.
     */
    static async get(bridgeId) {
        return CacheManager.get(`bridge:${bridgeId}`);
    }

    /**
     * Updates a bridge's data using a provided function.
     * @param {string} bridgeId - The unique identifier for the bridge.
     * @param {function(object): object} updaterFn - A function that receives the current bridge data and returns the updated data.
     * @returns {Promise<object>} The updated bridge data.
     */
    static async update(bridgeId, updaterFn) {
        const current = await this.get(bridgeId);
        const updated = updaterFn(current);
        await CacheManager.set(`bridge:${bridgeId}`, updated);
        return updated;
    }
}

module.exports = BridgeManager;
