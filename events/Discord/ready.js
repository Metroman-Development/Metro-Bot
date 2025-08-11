// events/Discord/ready.js
const MetroCore = require('../../modules/metro/core/MetroCore');
const StatusEmbeds = require('../../utils/embeds/statusEmbeds');
const logger = require('../logger');
const { getClient } = require('../../utils/clientManager');
const { REST, Routes } = require('discord.js');
const initializePresenceUpdates = require('../presenceUpdater');
const config = require('../../config/config.json');

module.exports = {
    name: 'ready',
    once : true, 
    /**
     * Handles the 'ready' event for the Discord client.
     * This function initializes the bot's subsystems, deploys slash commands,
     * and sends a status message to a designated channel.
     * @param {import('discord.js').Client} client The Discord client instance.
     */
    async execute(client) {
        client = client || getClient();
        
        logger.info('🚀 Starting bot initialization sequence...');
        const statusChannel = client.channels.cache.get(config.statusChannelID);

        try {
            // 1. Command Deployment Phase
            logger.info('1️⃣ Starting slash command deployment...');
            await deploySlashCommands(client);
            logger.info('✅ Slash command deployment completed');

            // 2. MetroCore Initialization
            logger.info('2️⃣ Initializing MetroCore subsystem...');
            const metro = await client.metroCore.getInstance({ client });
            const statusEmbeds = new StatusEmbeds(metro);
            logger.info(`✅ MetroCore initialized (Version: ${metro.version || 'unknown'})`);

            // 3. Presence System Setup
            logger.info('3️⃣ Configuring presence updates...');
            const cleanupPresenceUpdates = initializePresenceUpdates(client, metro);
            client.on('disconnect', cleanupPresenceUpdates);
            client.on('shardDisconnect', cleanupPresenceUpdates);
            logger.info('✅ Presence system active with cleanup handlers registered');

            // 4. Status Reporting
            logger.info('4️⃣ Preparing initial status reports...');
            //await metro.sendFullStatusReport();
            logger.debug('⚠️ Full status report temporarily disabled');

            // 5. Status Embed Dispatch
            logger.info('5️⃣ Building and sending status embed...');
            const networkStatus = metro._subsystems.statusService.getNetworkStatus();
            logger.debug('📊 Network status data retrieved', networkStatus);
            
            const statusEmbed = statusEmbeds.buildOverviewEmbed(networkStatus);
            await statusChannel.send({ embeds: [statusEmbed] });
            logger.info('📨 Status embed successfully dispatched');

            // Finalization
            logger.info(`🎉 Bot initialization completed successfully in ${process.uptime().toFixed(2)}s`);
            logger.debug('Bot Ready Details:', {
                guilds: client.guilds.cache.size,
                users: client.users.cache.size,
                commands: client.commands.size
            });

        } catch (error) {
            logger.error('💥 Critical initialization failure:', {
                error: error.message,
                stack: error.stack
            });
            
            console.error('Initialization failed:', error);
            
            try {
                // Note: metro object might not be available here, so we can't instantiate StatusEmbeds
                // We will have to call the error embed method statically if we make it so
                // For now, let's assume we can't create a fancy embed if MetroCore fails.
                await statusChannel.send(`:x: **Critical initialization failure:** ${error.message}`);
                logger.error('📨 Sent failure notification to status channel');
            } catch (channelError) {
                logger.error('❌ Failed to send failure notification:', channelError);
            }
        }
    }
};

/**
 * Deploys slash commands to Discord.
 * It reads the commands from the client's command collection,
 * formats them for the Discord API, and then sends them.
 * @param {import('discord.js').Client} client The Discord client instance.
 */
async function deploySlashCommands(client) {
    try {
        logger.debug('Compiling slash commands...');
        const commands = [];
        
        client.commands.forEach(command => {
            if (command.data && command.data.toJSON) {
                commands.push(command.data.toJSON());
                logger.debug(`- Prepared command: ${command.data.name}`);
            }
        });

        if (commands.length === 0) {
            logger.warn('⚠️ No slash commands found to register');
        }

        logger.info(`Attempting to register ${commands.length} commands...`);
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        
        const result = await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );

        logger.info(`✅ Successfully registered ${result.length} application commands`);
        logger.debug('Command registration details:', {
            registeredCommands: result.map(cmd => cmd.name),
            botId: client.user.id
        });
        
    } catch (error) {
        logger.error('❌ Command deployment failed:', {
            error: error.message,
            requestBody: error.requestBody,
            status: error.status
        });
        throw error;
    }
}
