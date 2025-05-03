const { Events } = require('discord.js');
const logger = require('../logger');

module.exports = {
    name: Events.GuildCreate,
    async execute(guild) {
        try {
            logger.info('GUILD_JOINED', {
                id: guild.id,
                name: guild.name,
                memberCount: guild.memberCount
            });
            
            // Initialize guild in database
            await initializeGuildSystems(guild);
            
        } catch (error) {
            logger.error('GUILD_INIT_FAILED', {
                guild: guild.id,
                error: error.message,
                stack: error.stack
            });
        }
    }
};