const { createGeneralStationInfo, createStationSurroundings } = require('../../../config/defaultEmbeds/stationInfoEmbed');
const { getCache, deleteCache, setCache } = require('../../../utils/cache'); // Import setCache
const logger = require('../../logger');
const { getStationDetails } = require('../../../utils/stationUtils'); // Import getStationDetails

// Timeout duration (5 minutes)
const BUTTON_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds

module.exports = {
    customId: 'stationInf_', // Prefix to identify these buttons
    async execute(interaction, client) {
        try {
            // Ensure it's a button interaction
            if (!interaction.isButton()) {
                console.error('❌ Interaction is not a button:', interaction);
                return;
            }

            // Extract values from customId (format: stationInf_userId_interactionId_buttonType)
            const [prefix, userId, interactionId, buttonType] = interaction.customId.split('_');

            // Retrieve the station data from the cache
            const embedId = `${userId}_${interactionId}`;
            const cachedData = getCache(userId, embedId);

            if (!cachedData || !cachedData.data) {
                console.error(`❌ Cache entry not available for embedId = ${embedId}`);
                await interaction.editReply({ content: '❌ No se pudo cargar la información de la estación. Por favor, intenta nuevamente.', components: [] });
                return;
            }

            const station = cachedData.data;

            let embed, buttons;

            // Handle different button types
            switch (buttonType) {
                case 'main':
                    // Create the general station info embed
                    ({ embed, buttons } = await createGeneralStationInfo(station, userId, interactionId));
                    break;

                case 'surround':
                    // Create the surroundings embed
                    ({ embed, buttons } = createStationSurroundings(station, userId, interactionId));
                    break;

                case 'transfer':
                    // Handle transfer station logic
                    if (!station.transfer) {
                        return await interaction.reply({
                            content: '❌ Esta estación no tiene una estación de transferencia.',
                            ephemeral: true,
                        });
                    }

                    // Get the transfer line (e.g., "L1", "L2", "L4A")
                    const transferLine = `${station.transfer}`;
                    
                    const stat = station.name.replace(/\s*l\d+[a-z]*$/i, '');

                    // Construct the transfer station name with the new suffix
                    const transferStationName = `${stat} ${transferLine}`;

                    // Search for the transfer station using the updated name
                    const transferStation = getStationDetails(transferStationName); // Use getStationDetails instead of getStation

                    if (!transferStation) {
                        return await interaction.reply({
                            content: `❌ No se pudo encontrar la estación de transferencia: ${transferStationName}`,
                            ephemeral: true,
                        });
                    }

                    // Update the cache with the transfer station data
                    setCache(userId, embedId, { data: transferStation });

                    // Create the general station info embed for the transfer station
                    ({ embed, buttons } = await createGeneralStationInfo(transferStation, userId, interactionId));
                    break;

                default:
                    console.error(`❌ Unknown button type: ${buttonType}`);
                    return await interaction.reply({
                        content: '❌ Botón no reconocido.',
                        ephemeral: true,
                    });
            }

            // Update the interaction with the appropriate embed and buttons
            await interaction.editReply({ embeds: [embed], components: buttons });

            // Set a timeout to delete the buttons and clear the cache after 5 minutes
            setTimeout(async () => {
                try {
                    await interaction.editReply({ components: [] }); // Remove buttons
                    deleteCache(userId, embedId); // Clear the cache
                    logger.info(`Buttons and cache cleared for interaction ${embedId}`);
                } catch (error) {
                    logger.error(`Error clearing buttons and cache for interaction ${embedId}: ${error.message}`);
                }
            }, BUTTON_TIMEOUT);
        } catch (error) {
            console.error('❌ Error handling station button:', error);
            await interaction.followUp({
                content: '❌ Ocurrió un error al procesar la solicitud. Por favor, intenta nuevamente.',
                ephemeral: true,
            });
        }
    },
};