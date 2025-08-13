const { CacheManager } = require('./cache/CacheManager');

class BridgeManager {
    static async create(bridgeId, initialData) {
        await CacheManager.set(`bridge:${bridgeId}`, {
            ...initialData,
            history: []
        });
    }

    static async get(bridgeId) {
        return CacheManager.get(`bridge:${bridgeId}`);
    }

    static async update(bridgeId, updaterFn) {
        const current = await this.get(bridgeId);
        const updated = updaterFn(current);
        await CacheManager.set(`bridge:${bridgeId}`, updated);
        return updated;
    }
}

module.exports = BridgeManager;