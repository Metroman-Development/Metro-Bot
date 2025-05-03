const logger = require('../../events/logger');
const StatusUpdater = require('./embeds/StatusUpdater');
const StatusEmbedBuilder = require('./embeds/StatusEmbedBuilder');

module.exports = async function createStatusSystem(metro, options = {}) {
    const config = {
        maxRetries: 3,
        retryDelay: 3000,
        verifyDependencies: true,
        ...options
    };

    // Dependency verification
    if (config.verifyDependencies) {
        if (!metro?.isReady) {
            throw new Error('MetroCore not ready - initialize it first');
        }
        if (!metro.indexes?.lines.size || !metro.data) {
            throw new Error('MetroCore data not loaded');
        }
    }

    // Initialize components
    const updater = new StatusUpdater(metro);
    const embeds = new StatusEmbedBuilder();

    // Verify system functionality
    let lastError;
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
        try {
            await updater.verify();
            logger.info('STATUS_SYSTEM_READY', `Initialized on attempt ${attempt}`);
            
            return {
                update: updater.handleUpdate.bind(updater),
                refresh: updater.forceRefresh.bind(updater),
                getState: () => ({
                    ready: true,
                    lastUpdate: updater.lastUpdate,
                    metroReady: metro.isReady
                })
            };
        } catch (error) {
            lastError = error;
            if (attempt === config.maxRetries) break;
            await sleep(config.retryDelay);
        }
    }

    throw new Error(`StatusSystem failed to initialize: ${lastError.message}`);
};