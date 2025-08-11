const { Events } = require('discord.js');
const interactionHandler = require('../../modules/interactions/interactionHandler');
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
            } else if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit() || interaction.isContextMenuCommand()) {
                // For other interactions, delegate to the interactionHandler module.
                return interactionHandler.execute(interaction);
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
