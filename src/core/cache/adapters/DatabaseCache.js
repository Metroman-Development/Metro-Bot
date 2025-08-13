
const DatabaseManager = require('../../database/DatabaseManager');
const CacheModel = require('../../database/models/CacheModel'); // Import CacheModel directly
const logger = require('../../../events/logger');

class DatabaseCache {
    constructor() {
        this.stats = {
            queries: 0,
            errors: 0
        };
        this.cacheModel = null;
        this.initialize();
    }

    async initialize() {
        try {
            const db = await DatabaseManager.getInstance();
            this.cacheModel = new CacheModel(db); // Create CacheModel instance
            logger.info('DatabaseCache initialized successfully');
        } catch (error) {
            logger.error(`DatabaseCache initialization failed: ${error.message}`);
            throw error;
        }
    }

    async get(namespace, key) {
        if (!this.cacheModel) {
            logger.error('DatabaseCache not initialized');
            return undefined;
        }

        try {
            const result = await this.cacheModel.get(namespace, key);
            this.stats.queries++;
            return result ? JSON.parse(result.value) : undefined;
        } catch (error) {
            this.stats.errors++;
            logger.error(`DatabaseCache get error: ${error.message}`, {
                namespace,
                key,
                error: error.stack
            });
            return undefined;
        }
    }

    async set(namespace, key, value, ttl) {
        if (!this.cacheModel) {
            logger.error('DatabaseCache not initialized');
            return;
        }

        try {
            await this.cacheModel.set(namespace, key, value, ttl);
            this.stats.queries++;
            logger.debug(`Cache set: ${namespace}.${key} (TTL: ${ttl}ms)`);
        } catch (error) {
            this.stats.errors++;
            logger.error(`DatabaseCache set error: ${error.message}`, {
                namespace,
                key,
                error: error.stack
            });
        }
    }

    async cleanup() {
        if (!this.cacheModel) {
            logger.error('DatabaseCache not initialized');
            return 0;
        }

        try {
            const result = await this.cacheModel.cleanup();
            this.stats.queries++;
            logger.info(`Cache cleanup completed, affected rows: ${result.affectedRows}`);
            return result.affectedRows || 0;
        } catch (error) {
            this.stats.errors++;
            logger.error(`DatabaseCache cleanup error: ${error.message}`, {
                error: error.stack
            });
            return 0;
        }
    }

    getStats() {
        return {
            type: 'database',
            ...this.stats,
            initialized: !!this.cacheModel
        };
    }
}

module.exports = DatabaseCache;


