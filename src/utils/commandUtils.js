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

    const errorMessageContent = '❌ Ocurrió un error al procesar tu solicitud. Por favor, inténtalo de nuevo más tarde.';

    // Ensure error is an instance of Error
    const err = error instanceof Error ? error : new Error(error);

    logger.error(`Error executing command: ${err.message}`, {
        error: {
            message: err.message,
            stack: err.stack,
            ...err
        },
        command: interactionOrMessage.id,
        user: interactionOrMessage.user?.id || interactionOrMessage.author?.id,
    });

    const errorMessage = {
        content: errorMessageContent
    };

    try {
        if (interactionOrMessage instanceof Interaction) {
            if (interactionOrMessage.deferred || interactionOrMessage.replied) {
                await interactionOrMessage.followUp(errorMessage);
            } else {
                await interactionOrMessage.reply(errorMessage);
            }
        } else if (interactionOrMessage instanceof Message) {
            await interactionOrMessage.channel.send(errorMessage.content);
        }
    } catch (e) {
        logger.error('Failed to send error message to user.', {
            originalError: err.message,
            followUpError: e.message
        });
    }
}

module.exports = {
    handleCommandError,
};
