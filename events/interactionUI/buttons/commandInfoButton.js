const { getCache, setCache } = require('../../../utils/cache');

const { generateCommandEmbed } = require('../../../config/defaultEmbeds/ayudaEmbed');

module.exports = {

    customId: 'commandInfo_', // Matches the prefix in the customId

    async execute(interaction, client) {

        try {

            // Extract userId, interactionId, and commandName from the customId

            const [prefix, userId, interactionId, commandName] = interaction.customId.split('_');

            // Log the extracted values for debugging

            console.log(`Extracted values: userId=${userId}, interactionId=${interactionId}, commandName=${commandName}`);

            // Retrieve cached data using userId and interactionId

            const cachedData = getCache(userId, interactionId);

            console.log('Cached Data:', cachedData);

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

            // Validate cachedData.categories

            if (!cachedData.categories || typeof cachedData.categories !== 'object') {

                console.error('Invalid categories in cached data:', cachedData.categories);

                return interaction.followUp({

                    content: '❌ No se pudo cargar la información de los comandos.',

                    ephemeral: true,

                });

            }

            // Find the command in the cached data

            let command = null;

            for (const category of Object.values(cachedData.categories)) {

                command = category.find(cmd => cmd.name === commandName); // Match without a slash

                if (command) break; // Exit the loop if the command is found

            }

            if (!command) {

                return interaction.followUp({

                    content: `❌ No se encontró el comando "/${commandName}".`,

                    ephemeral: true,

                });

            }

            // Store the current state in the history array

            const history = cachedData.history || [];

            history.push({

                type: 'category',

                category: cachedData.currentCategory, // Store the current category

                commands: cachedData.categories[cachedData.currentCategory], // Store the commands

                embed: interaction.message.embeds[0], // Store the current embed

                components: interaction.message.components, // Store the current components

            });

            // Limit the history to 25 states

            if (history.length > 25) {

                history.shift(); // Remove the oldest state

            }

            // Update the cache with the new history

            setCache(userId, interactionId, {

                ...cachedData,

                history,

                timestamp: Date.now(), // Update the timestamp

            });

            // Generate the command embed

            const { embed, components } = generateCommandEmbed(command, userId, interactionId);

            // Update the interaction with the new embed and buttons

            await interaction.editReply({ embeds: [embed], components });

        } catch (error) {

            console.error('❌ Error in commandInfoButton handler:', error);

            await interaction.followUp({

                content: '❌ Ocurrió un error al procesar la interacción.',

                ephemeral: true,

            });

        }

    },

};