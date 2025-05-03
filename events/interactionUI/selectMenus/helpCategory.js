const { getCache } = require('../../../utils/cache');

const { generateCategoryEmbed } = require('../../../config/defaultEmbeds/ayudaEmbed');

module.exports = {

    customId: 'helpCategory_', // Matches the prefix in the customId

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

            const selectedCategory = interaction.values[0];

            const commands = cachedData.categories[selectedCategory];

            if (!commands) {

                return interaction.followUp({

                    content: '❌ No se encontraron comandos para esta categoría.',

                    ephemeral: true,

                });

            }

            // Generate the category embed with buttons

            const { embed, components } = generateCategoryEmbed(selectedCategory, commands, userId, interactionId);

            // Update the interaction with the new embed and buttons

            await interaction.editReply({ embeds: [embed], components });

        } catch (error) {

            console.error('❌ Error in helpCategory handler:', error);

            await interaction.followUp({

                content: '❌ Ocurrió un error al procesar la interacción.',

                ephemeral: true,

            });

        }

    },

}; 