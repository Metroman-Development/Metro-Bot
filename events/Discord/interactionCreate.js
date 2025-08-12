const { Events } = require('discord.js');
const logger = require('../logger');

/**
 * @typedef {import('discord.js').Interaction} Interaction
 */

module.exports = {
    name: Events.InteractionCreate,
    /**
     * Handles incoming interactions from Discord.
     * It routes different interaction types to their respective handlers.
     * @param {Interaction} interaction The interaction object from Discord.
     */
    async execute(interaction) {
        const { client } = interaction;

        try {
            if (interaction.isCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) {
                    logger.warn(`No command matching ${interaction.commandName} was found.`);
                    return;
                }
                await command.execute(interaction);
            } else if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
                // New interaction handling system based on customId prefixes
                const { customId } = interaction;
                if (!customId) {
                    logger.warn('Interaction has no customId:', interaction);
                    return;
                }

                // Find the handler whose prefix matches the start of the customId
                for (const [prefix, handler] of client.interactionHandlers.entries()) {
                    if (customId.startsWith(prefix)) {
                        return handler.execute(interaction);
                    }
                }

                logger.warn(`No interaction handler found for customId: ${customId}`);
            }
        } catch (error) {
            logger.error('Error executing interaction:', {
                commandName: interaction.commandName,
                user: interaction.user.tag,
                error: error.message,
                stack: error.stack,
            });

            const response = {
                content: 'There was an error while executing this command!',
                ephemeral: true
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(response);
            } else {
                await interaction.reply(response);
            }
        }
    },
};
