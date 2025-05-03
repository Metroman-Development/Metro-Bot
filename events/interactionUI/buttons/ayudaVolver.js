const { getCache, setCache } = require('../../../utils/cache');
const { generateInitialEmbed, generateCategoryEmbed } = require('../../../config/defaultEmbeds/ayudaEmbed');

module.exports = {
    customId: 'ayudaGoBack_', // Matches the prefix in the customId
    async execute(interaction, client) {
        try {
            // Extract userId and interactionId from the customId
            const [prefix, userId, interactionId] = interaction.customId.split('_');

            // Retrieve cached data using userId and interactionId
            const cachedData = getCache(userId, interactionId);
            if (!cachedData) {
                return interaction.followUp({
                    content: '❌ The interaction expired. Use the command again.',
                    ephemeral: true,
                });
            }

            // Check if the cached data is older than 5 minutes
            const now = Date.now();
            if (now - cachedData.timestamp > 5 * 60 * 1000) { // 5-minute timeout
                return interaction.followUp({
                    content: '❌ The interaction expired. Use the command again.',
                    ephemeral: true,
                });
            }

            // Check if there's a history array in the cache
            if (!cachedData.history || cachedData.history.length === 0) {
                return interaction.followUp({
                    content: '❌ No hay un estado anterior al que volver.',
                    ephemeral: true,
                });
            }

            // Get the latest state from the history
            const previousState = cachedData.history.pop(); // Remove the latest state from the history

            // Update the cache with the updated history
            setCache(userId, interactionId, {
                ...cachedData,
                history: cachedData.history, // Update the history array
                timestamp: Date.now(), // Update the timestamp
            });

            // Restore the previous state
            await interaction.editReply({
                embeds: [previousState.embed],
                components: previousState.components,
            });
        } catch (error) {
            console.error('❌ Error in ayudaGoBackButton handler:', error);
            await interaction.followUp({
                content: '❌ Ocurrió un error al procesar la interacción.',
                ephemeral: true,
            });
        }
    },
};