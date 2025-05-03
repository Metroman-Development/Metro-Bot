const { CacheManager } = require('../../../../core/cache/CacheManager');

module.exports = {
  get: (key) => CacheManager.get(`metro:${key}`),
  set: (key, value) => CacheManager.set(`metro:${key}`, value)
};