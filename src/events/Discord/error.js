const { Events } = require('discord.js');
const logger = require('../logger');

module.exports = {
    name: Events.Error,
    async execute(error) {
        console.error('DISCORD_CLIENT_ERROR', {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });

        // Handle specific error types
        if (error.code === 'ECONNRESET') {
            logger.warn('NETWORK_ERROR', 'Connection reset, may retry');
        } else if (error.code === 'ETIMEDOUT') {
            console.warn('NETWORK_ERROR', 'Connection timed out');
        } else if (error.code === 429) {
            console.warn('RATE_LIMITED', 'Hit Discord API rate limit');
        }
    }
};
