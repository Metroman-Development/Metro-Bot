const MemoryCache = require('./adapters/MemoryCache');
const logger = require('../../events/logger');

class CacheManager {
    static getInstance(options) {
        if (!CacheManager._instance) {
            CacheManager._instance = new CacheManager(options);
        }
        return CacheManager._instance;
    }

    constructor(options = {}) {
        this.layers = [
            new MemoryCache({
                maxSize: options.memorySize || 1000,
                gcInterval: options.gcInterval || 60000
            })
        ];
        
        this.stats = {
            hits: 0,
            misses: 0,
            writes: 0
        };
        
        logger.info('CacheManager initialized with layered cache system');
    }

    async get(namespace, key) {
        let value;
        
        // Check each cache layer in order
        for (const [index, layer] of this.layers.entries()) {
            try {
                value = await layer.get(namespace, key);
                
                if (value !== undefined && value !== null) {
                    this.stats.hits++;
                    
                    // Update higher layers with the value from lower layers
                    if (index > 0) {
               
                    await Promise.all(
       this.layers.slice(0, index).map(l => 
           l.set(namespace, key, value)
       ) // Properly aligned closing brackets
   );
                    
                    }
                    return value;
                }
            } catch (error) {
                logger.error(`Cache layer ${index} get error:`, error);
            }
        }
        
        this.stats.misses++;
        return undefined;
    }

    async set(namespace, key, value, ttl = 300000) {
        try {
            await Promise.all(
                this.layers.map(layer => 
                    layer.set(namespace, key, value, ttl)
                )
            );
            this.stats.writes++;
            return true;
        } catch (error) {
            logger.error('CacheManager set error:', error);
            return false;
        }
    }

    async delete(namespace, key) {
        try {
            await Promise.all(
                this.layers.map(layer => 
                    layer.delete(namespace, key)
                )
            );
            return true;
        } catch (error) {
            logger.error('CacheManager delete error:', error);
            return false;
        }
    }

    async wrap(namespace, key, fallback, ttl = 300000) {
        const cached = await this.get(namespace, key);
        if (cached !== undefined) {
            return cached;
        }
        
        const result = await fallback();
        await this.set(namespace, key, result, ttl);
        return result;
    }

    async cleanup() {
        try {
            const results = await Promise.all(
                this.layers.map(layer => layer.cleanup())
            );
            return {
                memory: results[0]
            };
        } catch (error) {
            logger.error('CacheManager cleanup error:', error);
            throw error;
        }
    }

    getStats() {
        return {
            ...this.stats,
            layers: this.layers.map(layer => layer.getStats())
        };
    }

    async flush() {
        try {
            await Promise.all(
                this.layers.map(layer => {
                    if (typeof layer.flush === 'function') {
                        return layer.flush();
                    }
                    return Promise.resolve();
                })
            );
            this.stats = { hits: 0, misses: 0, writes: 0 };
            return true;
        } catch (error) {
            logger.error('CacheManager flush error:', error);
            return false;
        }
    }
}

// Export the class
module.exports = CacheManager;