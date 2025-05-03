 const metro = require('../modules/metro'); // Main metro system
const { initializeEmbeds } = require('../statusHelpers/embedManager');
const logger = require('./logger');
const { validateBootIntegrity } = require('../database/bootValidator');
const chronos = require('../modules/chronos');

// Core Functions
const updateEmbeds = async (client) => {
    try {
        const { updateOverviewEmbed, updateLineEmbeds } = initializeEmbeds(client);
        const currentData = metro.core.data;
        
        await updateOverviewEmbed(currentData);
        await updateLineEmbeds(currentData);
        logger.info('Embeds updated successfully');
    } catch (error) {
        logger.error(`Embed update failed: ${error.message}`);
    }
};

// Main Functions
const processUpdates = async (client) => {
    try {
        logger.info('Starting update cycle');
        
        if (!await validateBootIntegrity()) {
            logger.warn('Proceeding with data consistency issues');
        }

        // Use MetroCore's built-in update mechanism
        const updateSuccess = await metro.core.updateCache();
        if (!updateSuccess) throw new Error('Cache update failed');

        await updateEmbeds(client);
        logger.info('Update completed successfully');
        
    } catch (error) {
        logger.error(`Update failed: ${error.message}`);
        
        // Fallback to cached data if available
        if (metro.core.data) {
            await updateEmbeds(client);
        }
    }
};

const initializeApiUpdates = async (client) => {
    try {
        logger.info('Starting system initialization');
        
        if (!await validateBootIntegrity()) {
            logger.warn('Initializing with validation warnings');
        }

        // Initialize scheduling system
        chronos.init(client);
        
        // Initialize MetroCore (includes initial data load)
        await metro.core.initialize();
        
        // Initial embed update
        await updateEmbeds(client);
        
        // Start periodic updates (every 5 minutes)
        setInterval(() => processUpdates(client), 300000);
        
        logger.info('System initialization completed');
    } catch (error) {
        logger.error(`Initialization failed: ${error.message}`);
        
        // Try to show closed state if initialization fails
        if (metro.core.generateClosedState) {
            metro.core.update(metro.core.generateClosedState());
            await updateEmbeds(client);
        }
        
        process.exit(1);
    }
};

module.exports = {
    initializeApiUpdates,
    processUpdates,
    updateEmbeds // Exposed for manual updates
};