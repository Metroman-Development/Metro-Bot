// events/interactionUI/buttons/serverButtons.js
const { getCache, deleteCache, setCache } = require('../../../utils/cache');
const logger = require('../../logger');
const { createMainServerInfo, createChannelsList, createRolesList } = require('../../../config/defaultEmbeds/serverInfoEmbeds');

const BUTTON_TIMEOUT = 5 * 60 * 1000; // 5 minutes

module.exports = {
    customId: 'serverInfo_', // Base customId to match
    async execute(interaction, client) {
        try {
            // Extract the action suffix from the customId
            const [prefix, action, userId, interactionId, page] = interaction.customId.split('_');

            // Log the customId and parsed values for debugging
            logger.info(`Button clicked: customId=${interaction.customId}, action=${action}, userId=${userId}, interactionId=${interactionId}, page=${page}`);

            // Retrieve cached data
            const embedId = `${userId}_${interactionId}`;
            let cachedData = getCache(userId, embedId);
            if (!cachedData) {
                logger.error(`No cached data found for embedId=${embedId}`);
                return await interaction.followUp({ content: '❌ No se pudo cargar la información.', ephemeral: true });
            }

            const serverInfo = cachedData.data;
            const guild = interaction.guild;

            // Handle different actions based on the suffix
            if (action === 'channels') {
                // Fetch public channels (text and voice)
                const publicChannels = guild.channels.cache.filter(
                    channel => channel.isTextBased() || channel.isVoiceBased()
                );

                // Map channels to their names
                serverInfo.channelsList = publicChannels.map(channel => channel.name);

                // Create the channels list embed with pagination
                const { embed, buttons } = createChannelsList(serverInfo, userId, interactionId, parseInt(page));

                // Update the interaction with the new embed and buttons
                await interaction.editReply({ embeds: [embed], components: buttons });
            } else if (action === 'roles') {
                // Fetch all roles
                serverInfo.rolesList = guild.roles.cache.map(role => role.name);

                // Create the roles list embed with pagination
                const { embed, buttons } = createRolesList(serverInfo, userId, interactionId, parseInt(page));

                // Update the interaction with the new embed and buttons
                await interaction.editReply({ embeds: [embed], components: buttons });
            } else if (action === 'main') {
                // Re-render the main server info embed
                const { embed, buttons } = createMainServerInfo(serverInfo, userId, interactionId);

                // Update the interaction with the main embed and buttons
                await interaction.editReply({ embeds: [embed], components: buttons });
            } else {
                // Handle unknown actions
                logger.warn(`Unknown action: ${action}`);
                await interaction.followUp({ content: '❌ Acción no reconocida.', ephemeral: true });
            }

            // Set a timeout to clean up the cache and buttons
            setTimeout(async () => {
                try {
                    deleteCache(userId, embedId);
                    logger.info(`Botones y caché limpiados para ${embedId}`);
                } catch (error) {
                    logger.error(`Error limpiando botones y caché: ${error.message}`);
                }
            }, BUTTON_TIMEOUT);
        } catch (error) {
            logger.error(`Error en serverInfo_: ${error.message}`);
            await interaction.followUp({ content: '❌ Ocurrió un error.', ephemeral: true });
        }
    },
};
