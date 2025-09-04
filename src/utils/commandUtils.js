const { Interaction, Message } = require('discord.js');
const logger = require('../events/logger');

/**
 * Handles errors that occur during command execution.
 * It sends a generic error message to the user and logs the full error.
 * @param {Error} error The error that was thrown.
 * @param {Interaction | Message} interactionOrMessage The interaction or message where the error occurred.
 */
async function handleCommandError(error, interactionOrMessage) {
    if (!interactionOrMessage) {
        logger.error('handleCommandError called with null interactionOrMessage.', { error });
        return;
    }

    logger.error(`Error executing command: ${error.message}`, {
        error,
        command: interactionOrMessage.id,
        user: interactionOrMessage.user?.id || interactionOrMessage.author?.id,
    });

    const errorMessage = {
        content: '❌ Ocurrió un error al procesar tu solicitud. Por favor, inténtalo de nuevo más tarde.'
    };

    if (interactionOrMessage instanceof Interaction) {
        if (interactionOrMessage.deferred || interactionOrMessage.replied) {
            await interactionOrMessage.followUp(errorMessage);
        } else {
            await interactionOrMessage.reply(errorMessage);
        }
    } else if (interactionOrMessage instanceof Message) {
        await interactionOrMessage.channel.send(errorMessage.content);
    }
}

module.exports = {
    handleCommandError,
};
