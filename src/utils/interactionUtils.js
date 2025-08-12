const { getCache, deleteCache } = require('./cache');
const logger = require('../events/logger');

// Standard error handling for interactions
const handleInteractionError = (interaction, error) => {
    logger.error('INTERACTION_ERROR', {
        type: interaction.type,
        customId: interaction.customId,
        error: error.message,
        stack: error.stack
    });

    const content = error.code === 'INTERACTION_EXPIRED'
        ? '⌛ This interaction has expired. Please try again.'
        : '❌ An error occurred while processing this interaction.';

    if (interaction.deferred || interaction.replied) {
        return interaction.followUp({ content, ephemeral: true });
    }
    return interaction.reply({ content, ephemeral: true });
};

// Standard timeout setup for interactions
const setupInteractionTimeout = (interaction, userId, cacheKey, timeout = 300000) => {
    return setTimeout(async () => {
        try {
            await interaction.editReply({ components: [] });
            deleteCache(userId, cacheKey);
            logger.info(`Cleaned up expired interaction: ${cacheKey}`);
        } catch (error) {
            logger.error('TIMEOUT_CLEANUP_ERROR', {
                cacheKey,
                error: error.message
            });
        }
    }, timeout);
};

module.exports = {
    handleInteractionError,
    setupInteractionTimeout
};
