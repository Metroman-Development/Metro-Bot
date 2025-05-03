// events/Discord/ready.js
// events/Discord/ready.js
const MetroCore = require('../../modules/metro/core/MetroCore');
const StatusEmbedBuilder = require('../../modules/status/embeds/StatusEmbedBuilder');
const logger = require('../logger');
const { getClient } = require('../../utils/clientManager');
const { REST, Routes } = require('discord.js');
const initializePresenceUpdates = require('../presenceUpdater'); // Add this line

module.exports = {
    name: 'ready',
    async execute(client) {
        client = client || getClient();
        const statusChannel = client.channels.cache.get('1350243847271092295');

        try {
            // 1. Deploy commands and initialize MetroCore
            await deploySlashCommands(client);
            const metro = await client.metroCore.getInstance({ client });

            // 2. Initialize presence updates
            const cleanupPresenceUpdates = initializePresenceUpdates(client, metro);
            client.on('disconnect', cleanupPresenceUpdates);
            client.on('shardDisconnect', cleanupPresenceUpdates);

            // 3. Send initial status
            //await metro.sendFullStatusReport();

            // 4. Send status embed
            const statusEmbed = StatusEmbedBuilder.buildOverviewEmbed(
                metro._subsystems.statusService.getNetworkStatus()
            );
            await statusChannel.send({ embeds: [statusEmbed] });

            logger.info('✅ Bot initialization completed successfully');

        } catch (error) {
            console.error('Initialization failed:', error);
            await statusChannel.send({
                embeds: [StatusEmbedBuilder.buildErrorEmbed(
                    'System Initialization Failed',
                    error.message
                )]
            });
        }
    }
};

async function deploySlashCommands(client) {
    try {
        const commands = [];
        client.commands.forEach(command => {
            if (command.data && command.data.toJSON) {
                commands.push(command.data.toJSON());
            }
        });

        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );

        logger.info(`✅ Registered ${commands.length} application commands`);
        
    } catch (error) {
        logger.error('❌ Failed to deploy slash commands:', error);
        throw error;
    }
}
