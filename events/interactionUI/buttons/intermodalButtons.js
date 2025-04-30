
// events/interactionUI/buttons/intermodalButtons.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getCache, setCache, deleteCache } = require('../../../utils/cache'); // Import cache utilities
const { createIntermodalEmbed } = require('../../../config/defaultEmbeds/intermodalEmbed'); // Import embed logic
const logger = require('../../logger');

module.exports = {
    customId: 'intermodal_', // Prefix to identify these buttons

    async execute(interaction, client) {
        logger.info(`Button interaction received: ${interaction.customId}`);

        // Split the customId into buttonType and interactionId
        const [interactionId, buttonType, embed] = interaction.customId.split('_');
        const userId = interaction.user.id; // Unique user ID for caching
        const embedId = embed;

        logger.info(`Button type: ${buttonType}, Interaction ID: ${embedId}, User ID: ${userId}`);

        try {
            // Retrieve cached data for this interaction
            const cachedData = getCache(userId, embedId);

            if (!cachedData) {
                logger.warn(`No cached data found for interaction ID: ${userId}`);
                return interaction.followUp({ content: 'La sesión ha expirado. Por favor, ejecuta el comando nuevamente.', ephemeral: true });
            }

            const { locationName, intermodalDetails, currentView, currentPage } = cachedData;

            let newView = currentView;
            let newPage = currentPage;

            // Handle button type
            if (buttonType === 'mainInfoButton') {
                newView = 'mainInfo'; // Switch to Main Info view
            } else if (buttonType === 'recorridosButton') {
                newView = 'recorridos'; // Switch to Recorridos view
            } else if (buttonType === 'nextPageButton') {
                newPage = currentPage + 1; // Go to the next page
            } else if (buttonType === 'prevPageButton') {
                newPage = Math.max(0, currentPage - 1); // Go to the previous page
            }

            // Update the cache with the new view and page
            setCache(userId, embedId, {
                ...cachedData,
                currentView: newView,
                currentPage: newPage
            });

            // Generate the updated embed and buttons
            const { embed, buttons } = createIntermodalEmbed(intermodalDetails, newView, embedId, newPage);

            // Update the interaction with the new embed and buttons
            await interaction.editReply({ embeds: [embed], components: [buttons] });
            logger.info(`Updated intermodal view for: ${locationName}, view: ${newView}, page: ${newPage}`);

            // Set a 5-minute timeout to disable buttons and clear cache
            setTimeout(async () => {
                try {
                    // Disable all buttons by editing the message to remove components
                    await interaction.editReply({ components: [] });
                    logger.info(`Buttons disabled after 5 minutes for interaction ID: ${embedId}`);

                    // Clear the cache for this interaction
                    deleteCache(userId, embedId);
                    logger.info(`Cache cleared for interaction ID: ${embedId}`);
                } catch (error) {
                    logger.error(`Error during timeout cleanup: ${error.message}`);
                }
            }, 5 * 60 * 1000); // 5 minutes in milliseconds
        } catch (error) {
            logger.error(`Error handling button interaction: ${error.message}`);
            interaction.followUp({ content: 'Ocurrió un error al procesar la interacción. Por favor, inténtalo de nuevo.', ephemeral: true });
        }
    }
};