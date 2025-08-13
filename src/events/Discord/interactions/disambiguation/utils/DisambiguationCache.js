const { CacheManager } = require('../../../../../core/cache/CacheManager');

class DisambiguationCache {
    static PREFIX = 'disambig:';
    static TTL = 300_000; // 5 minutes

    static async set(sessionId, data) {
        return CacheManager.set(
            `${this.PREFIX}${sessionId}`,
            data,
            { ttl: this.TTL }
        );
    }

    static async get(sessionId) {
        return CacheManager.get(`${this.PREFIX}${sessionId}`);
    }

    static async delete(sessionId) {
        return CacheManager.del(`${this.PREFIX}${sessionId}`);
    }
}

module.exports = DisambiguationCache;