const { Events } = require('discord.js');
const logger = require('../logger');
const { MetroInfoProvider } = require('../../utils/MetroInfoProvider');

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
        const metroInfoProvider = MetroInfoProvider.getInstance();

        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (!command || !command.autocomplete) return;

            try {
                await command.autocomplete(interaction, metroInfoProvider);
            } catch (error) {
                logger.error('Error handling autocomplete:', {
                    commandName: interaction.commandName,
                    user: interaction.user.tag,
                    error: error.message,
                });
            }
        } else if (interaction.isCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                logger.warn(`No command matching ${interaction.commandName} was found.`);
                return;
            }
            try {
                await command.execute(interaction, metroInfoProvider);
            } catch (error) {
                logger.error('Error executing command:', {
                    commandName: interaction.commandName,
                    user: interaction.user.tag,
                    error: error.message,
                    stack: error.stack,
                });
                // Optional: add a generic error reply here if commands don't handle their own errors
            }
        } else if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
            const { customId } = interaction;
            if (!customId) {
                logger.warn('Interaction has no customId:', interaction);
                return;
            }

            for (const [prefix, handler] of client.interactionHandlers.entries()) {
                if (customId.startsWith(prefix)) {
                    try {
                        await handler.execute(interaction, metroInfoProvider);
                    } catch (error) {
                        logger.error(`Error executing interaction handler for prefix "${prefix}":`, {
                            customId: interaction.customId,
                            user: interaction.user.tag,
                            error: error.message,
                            stack: error.stack,
                        });
                    }
                    return;
                }
            }

            logger.warn(`No interaction handler found for customId: ${customId}`);
        }
    },
};
