/**
 * @file commandUtils.js
 * @description Utilities for handling command execution and interactions.
 */

const { Interaction } = require('discord.js');

/**
 * Handles errors that occur during command execution.
 * It sends a generic error message to the user and logs the full error.
 * @param {Error} error The error that was thrown.
 * @param {Interaction} interaction The interaction where the error occurred.
 */
async function handleCommandError(error, interaction) {
    console.error(`Error executing command for interaction ${interaction.id}:`, error);

    const errorMessage = {
        content: '❌ Ocurrió un error al procesar tu solicitud. Por favor, inténtalo de nuevo más tarde.',
        ephemeral: true,
    };

    if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorMessage);
    } else {
        await interaction.reply(errorMessage);
    }
}

module.exports = {
    handleCommandError,
};
