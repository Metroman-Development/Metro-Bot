const { getCache, deleteCache } = require('../../../utils/cache');
const { isCombinacion } = require('../../../utils/utils');

module.exports = {
    customId: 'station_', // Prefix for identifying station-related buttons

    async execute(interaction, client) {
        try {
            // Ensure it's a button interaction
            if (!interaction.isButton()) {
                console.error('❌ Interaction is not a button:', interaction);
                return;
            }

            // Extract values from the customId
            const [prefix, userId, interactionId, selectedIndex] = interaction.customId.split('_');

            const embedId = `${userId}_${interactionId}`; // Ensure consistency with cache key
            const cachedData = getCache(userId, embedId);

            if (!cachedData || !cachedData.data) {
                console.error(`❌ Cache entry not available for embedId = ${embedId}`);
                console.log(`[Button] Current cache keys:`, Array.from(cache.keys()));
                await interaction.editReply({ content: '❌ Error: Cache entry not available.', components: [] });
                return;
            }

            // Parse and validate selectedIndex
            const index = parseInt(selectedIndex, 10);
            if (isNaN(index) || index < 0 || index >= cachedData.data.length) {
                console.error(`❌ Invalid selection index: ${selectedIndex}`);
                console.log(`[Button] uniqueMatches length: ${cachedData.data.length}`);
                await interaction.editReply({ content: '❌ Selección no válida.', components: [] });
                return;
            }

            const selectedMatch = cachedData.data[index];
            let selectedStation = selectedMatch.original;

            // Check if the station is a combinacion
            const stationNameWithLineKey = `${selectedMatch.original} L${selectedMatch.line}`;
            if (isCombinacion(stationNameWithLineKey)) {
                if (!selectedStation.includes(` L${selectedMatch.line}`)) {
                    selectedStation += ` L${selectedMatch.line}`;
                }
            }

            console.log(`User selected station: ${selectedStation}`);

            // Resolve the Promise in deepSearch with the selected match
            const resolve = cachedData.resolve;
            if (resolve) {
                resolve(selectedMatch);
                console.log(`[Button] Resolved with selected station: ${selectedMatch.original}`);
            }

            await interaction.followUp({
                content: `✅ Seleccionaste: **${selectedStation}**`,
                
                components: [], // Remove the buttons after selection
                ephemeral: true, 
            });

            deleteCache(userId, embedId); // Clean up the cache
        } catch (error) {
            console.error('❌ Error handling button interaction:', error);
            if (error.code === 10062) { // Unknown interaction
                await interaction.followUp({
                    content: '❌ La interacción expiró. Por favor, intenta nuevamente.',
                    ephemeral: true,
                });
            } else {
                throw error;
            }
        }
    },
};
