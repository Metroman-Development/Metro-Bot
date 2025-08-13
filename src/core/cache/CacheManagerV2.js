const MemoryCache = require('./adapters/MemoryCache');

class CacheManagerV2 {
  constructor(prefix, options = {}) {
    this.prefix = prefix;
    this.cache = new MemoryCache({
      maxSize: options.maxSize || 100,
      gcInterval: options.gcInterval || 60000
    });
  }

  async get(key) {
    return this.cache.get(this.prefix, key);
  }

  async set(key, value, ttl) {
    return this.cache.set(this.prefix, key, value, ttl);
  }
}

module.exports = {
  CacheManager: CacheManagerV2
};
