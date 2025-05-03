// events/interactionUI/buttons/lineInfoButtons.js
const { getLineData } = require('../../../utils/lineUtils');
const metroConfig = require('../../../config/metroConfig');
const styles = require('../../../config/styles.json');
const generalLineInfo = require('../../../config/defaultEmbeds/generalLineInfo');
const { getCache, setCache } = require('../../../utils/cache');
const { isExpressActive } = require('../../../utils/timeUtils');

module.exports = {
    customId: 'lineaInfo_', // Prefix to identify these buttons
    async execute(interaction, client) {
        try {
            // Extract values from customId (format: lineaInfo_userId_interactionId_lineKey)
            const [prefix, userId, interactionId, lineKey] = interaction.customId.split('_');

            // Log the extracted lineKey for debugging
            console.log(`Extracted lineKey: ${lineKey}`);

            // 1. Get data from cache
            const cachedData = getCache(userId, interactionId);
            if (!cachedData) {
                console.error(`❌ Cache not found for ${userId}_${interactionId}`);
                return interaction.followUp({ 
                    content: '❌ The interaction expired. Use the command again.', 
                    ephemeral: true 
                });
            }

            // Log the cached data for debugging
            console.log(`Cache retrieved for ${userId}_${interactionId}:`, cachedData);

            // 2. Get line data using getLineData
            const line = getLineData(lineKey);
            if (!line) {
                console.error(`❌ Line not found: ${lineKey}`);
                return interaction.followUp({ 
                    content: '❌ Invalid line.', 
                    ephemeral: true 
                });
            }

            // 3. Update cache with the new line
            setCache(userId, interactionId, { 
                ...cachedData, 
                currentLine: lineKey 
            });

            // 4. Get the embed and buttons from generalLineInfo
            const { embed, buttons } = generalLineInfo(
                {
                    ...line,
                    key: lineKey,
                    nombre: `Línea ${lineKey.toUpperCase().replace('l', '')}`,
                    color: styles.lineColors[lineKey] || '#5865F2'
                },
                userId,
                interactionId
            );

            // 5. Add Express Route status if applicable
            const activeOrNa = isExpressActive() ? "Activas" : "Inactivas";
            if (['l2', 'l4', 'l5'].includes(lineKey)) {
                embed.setDescription(
                    `${embed.data.description}\n\n**🚄 Rutas Expresas:** ${activeOrNa}.`
                );
            }

            // 6. Update the interaction with the new embed and buttons
            await interaction.editReply({ 
                embeds: [embed], 
                components: buttons 
            });

        } catch (error) {
            console.error('❌ Error in lineInfoButtons:', error);

            // If the interaction is already deferred or replied, use followUp
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({ 
                    content: '❌ Error updating the information.', 
                    ephemeral: true 
                });
            } else {
                await interaction.reply({ 
                    content: '❌ Error updating the information.', 
                    ephemeral: true 
                });
            }
        }
    }
};
