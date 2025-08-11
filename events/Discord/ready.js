const MetroCore = require('../../modules/metro/core/MetroCore');
const StatusEmbeds = require('../../utils/embeds/statusEmbeds');
const logger = require('../logger');
const { getClient } = require('../../utils/clientManager');
const { REST, Routes } = require('discord.js');
const initializePresenceUpdates = require('../presenceUpdater');
const config = require('../../config/config.json');

module.exports = {
    name: 'ready',
    once: true,
    /**
     * Handles the 'ready' event for the Discord client.
     * This function initializes the bot's subsystems, deploys slash commands,
     * and sends a status message to a designated channel.
     * @param {import('discord.js').Client} client The Discord client instance.
     */
    async execute(client) {
        client = client || getClient();
        
        console.log('\n================================================================');
        console.log('              🚀 Bot Initialization Sequence 🚀              ');
        console.log('================================================================');

        const statusChannel = client.channels.cache.get(config.statusChannelID);

        try {
            // Phase 1: Command Deployment
            console.log('\n[PHASE 1] Deploying Slash Commands...');
            await deploySlashCommands(client);
            console.log('[PHASE 1] ✅ Slash command deployment complete.');

            // Phase 2: MetroCore Initialization
            console.log('\n[PHASE 2] Initializing MetroCore Subsystem...');
            const metro = await client.metroCore.getInstance({ client });
            const statusEmbeds = new StatusEmbeds(metro);
            console.log(`[PHASE 2] ✅ MetroCore initialized (Version: ${metro.version || 'N/A'}).`);

            // Phase 3: Presence System Setup
            console.log('\n[PHASE 3] Configuring Presence Updates...');
            const cleanupPresenceUpdates = initializePresenceUpdates(client, metro);
            client.on('disconnect', cleanupPresenceUpdates);
            client.on('shardDisconnect', cleanupPresenceUpdates);
            console.log('[PHASE 3] ✅ Presence system active with cleanup handlers registered.');

            // Phase 4: Status Reporting (Temporarily Disabled)
            console.log('\n[PHASE 4] Preparing Initial Status Reports...');
            // await metro.sendFullStatusReport();
            console.log('[PHASE 4] ⚠️ Full status report is temporarily disabled.');

            // Phase 5: Status Embed Dispatch
            console.log('\n[PHASE 5] Building and Sending Status Embed...');
            const networkStatus = metro._subsystems.statusService.getNetworkStatus();
            
            const statusEmbed = statusEmbeds.buildOverviewEmbed(networkStatus);
            await statusChannel.send({ embeds: [statusEmbed] });
            console.log('[PHASE 5] ✅ Status embed successfully dispatched to designated channel.');

            // Finalization
            console.log('\n================================================================');
            console.log('              🎉 Bot Initialization Complete! 🎉              ');
            console.log('================================================================');
            console.log(`> Total execution time: ${process.uptime().toFixed(2)}s`);
            console.log(`> Guilds: ${client.guilds.cache.size}`);
            console.log(`> Users: ${client.users.cache.size}`);
            console.log(`> Commands Loaded: ${client.commands.size}`);
            console.log('================================================================');


        } catch (error) {
            logger.error('💥 A critical error occurred during the initialization sequence:', {
                error: error.message,
                stack: error.stack
            });
            
            console.error('❌ Initialization failed:', error);
            
            try {
                await statusChannel.send(`:x: **Critical initialization failure:** ${error.message}`);
                logger.error('📨 Successfully sent failure notification to status channel.');
            } catch (channelError) {
                logger.error('❌ Failed to send failure notification to status channel:', channelError);
            }
        }
    }
};

/**
 * Deploys application (slash) commands to Discord.
 * It reads commands from the client's command collection, formats them for the Discord API, and registers them.
 * @param {import('discord.js').Client} client The Discord client instance.
 */
async function deploySlashCommands(client) {
    try {
        const commands = [];
        client.commands.forEach(command => {
            if (command.data && typeof command.data.toJSON === 'function') {
                commands.push(command.data.toJSON());
            }
        });

        if (commands.length === 0) {
            logger.warn('⚠️ No slash commands were found to register. Skipping deployment.');
            return;
        }

        console.log(`[DEPLOY] Attempting to register ${commands.length} application commands...`);
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        
        const result = await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );

        console.log(`[DEPLOY] ✅ Successfully registered ${result.length} application commands.`);
        
    } catch (error) {
        logger.error('❌ Command deployment failed:', {
            error: error.message,
            requestBody: error.requestBody ? error.requestBody.body : null,
            status: error.status
        });
        throw error; // Re-throw to be caught by the main initialization block
    }
}
