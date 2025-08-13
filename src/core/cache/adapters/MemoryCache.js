class MemoryCache {
    constructor(options = {}) {
        this.store = new Map();
        this.ttlStore = new Map();
        this.maxSize = options.maxSize || 1000;
        this.stats = {
            hits: 0,
            misses: 0,
            size: 0,
            evictions: 0
        };

        // Setup cleanup interval
        this.cleanupInterval = setInterval(() => this.cleanup(), options.gcInterval || 60000);
        this.cleanupInterval.unref();
    }

    async get(namespace, key) {
        const cacheKey = `${namespace}:${key}`;
        const expiresAt = this.ttlStore.get(cacheKey);

        if (expiresAt && expiresAt < Date.now()) {
            this.store.delete(cacheKey);
            this.ttlStore.delete(cacheKey);
            this.stats.size--;
            this.stats.misses++;
            return undefined;
        }

        if (this.store.has(cacheKey)) {
            this.stats.hits++;
            return this.store.get(cacheKey);
        }

        this.stats.misses++;
        return undefined;
    }

    async set(namespace, key, value, ttl = 300000) {
        const cacheKey = `${namespace}:${key}`;
        
        // Evict if needed (LRU strategy)
        if (this.store.size >= this.maxSize && !this.store.has(cacheKey)) {
            const firstKey = this.store.keys().next().value;
            this.store.delete(firstKey);
            this.ttlStore.delete(firstKey);
            this.stats.evictions++;
            this.stats.size--;
        }

        this.store.set(cacheKey, value);
        this.ttlStore.set(cacheKey, Date.now() + ttl);
        if (!this.store.has(cacheKey)) this.stats.size++;
    }

    async delete(namespace, key) {
        const cacheKey = `${namespace}:${key}`;
        const existed = this.store.has(cacheKey);
        this.store.delete(cacheKey);
        this.ttlStore.delete(cacheKey);
        if (existed) this.stats.size--;
    }

    async cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, expiresAt] of this.ttlStore) {
            if (expiresAt <= now) {
                this.store.delete(key);
                this.ttlStore.delete(key);
                cleaned++;
            }
        }

        this.stats.size -= cleaned;
        return cleaned;
    }

    getStats() {
        return {
            type: 'memory',
            ...this.stats,
            maxSize: this.maxSize
        };
    }

    destroy() {
        clearInterval(this.cleanupInterval);
        this.store.clear();
        this.ttlStore.clear();
    }
}

module.exports = MemoryCache;