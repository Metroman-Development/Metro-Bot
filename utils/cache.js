
const cache = new Map(); // Key: `${userId}_${embedId}`, Value: { data, resolve, reject, timestamp }

// Get cache entry

function getCache(userId, embedId) {

    const cacheKey = `${userId}_${embedId}`;

    return cache.get(cacheKey) || null;

}

// Set cache entry

function setCache(userId, embedId, data) {

    const cacheKey = `${userId}_${embedId}`;

    cache.set(cacheKey, {

        ...data,

        timestamp: Date.now(),

    });

    console.log(`[Cache] Stored data for cacheKey = ${cacheKey}`);

}

// Delete cache entry

function deleteCache(userId, embedId) {

    const cacheKey = `${userId}_${embedId}`;

    cache.delete(cacheKey);

    console.log(`[Cache] Deleted data for cacheKey = ${cacheKey}`);

}

// Get all cache entries

function getAllCache() {

    return Array.from(cache.entries()).map(([key, value]) => ({

        key,

        data: value.data,

        timestamp: value.timestamp,

    }));

}

// Export the cache Map and functions

module.exports = { getCache, setCache, deleteCache, getAllCache, cache };