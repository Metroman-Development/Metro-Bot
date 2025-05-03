class CacheModel {
    constructor(db) {
        this.db = db;
    }

    async get(namespace, key) {
        return this.db.findOne('cache', {
            namespace,
            cache_key: key,
            expires_at: ['>', new Date()]
        });
    }

    async set(namespace, key, value, ttl) {
        const expiresAt = new Date(Date.now() + ttl);
        return this.db.query(
            `INSERT INTO cache (namespace, cache_key, value, expires_at)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                value = VALUES(value),
                expires_at = VALUES(expires_at)`,
            [namespace, key, JSON.stringify(value), expiresAt]
        );
    }

    async delete(namespace, key) {
        return this.db.execute(
            'DELETE FROM cache WHERE namespace = ? AND cache_key = ?',
            [namespace, key]
        );
    }

    async cleanup() {
        return this.db.execute(
            'DELETE FROM cache WHERE expires_at <= NOW()'
        );
    }
}

module.exports = CacheModel;