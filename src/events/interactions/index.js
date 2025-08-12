/**
 * @module interactionLoader
 * @description Dynamically loads and retrieves handlers for all types of interactions.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../logger');

const buttonHandlers = new Map();
const modalHandlers = new Map();
const selectMenuHandlers = new Map();

/**
 * Loads all interaction handlers from their respective subdirectories.
 */
function loadInteractionHandlers() {
    const interactionTypes = [
        { name: 'buttons', handlers: buttonHandlers },
        { name: 'modals', handlers: modalHandlers },
        { name: 'selectMenus', handlers: selectMenuHandlers }
    ];

    for (const type of interactionTypes) {
        const handlersPath = path.join(__dirname, type.name);
        if (!fs.existsSync(handlersPath)) continue;

        const handlerFiles = fs.readdirSync(handlersPath).filter(file => file.endsWith('.js'));

        for (const file of handlerFiles) {
            try {
                const handlerModule = require(path.join(handlersPath, file));
                const handlers = Array.isArray(handlerModule) ? handlerModule : [handlerModule];

                handlers.forEach(handler => {
                    if (handler.customId) {
                        type.handlers.set(handler.customId, handler);
                        logger.info(`✅ Loaded ${type.name} handler: ${handler.customId}`);
                    }
                });
            } catch (error) {
                logger.error(`Error loading ${type.name} handler from ${file}: ${error.message}`);
            }
        }
    }
}

/**
 * Retrieves the appropriate handler for a given interaction.
 * @param {import('discord.js').Interaction} interaction - The interaction object.
 * @returns {object|null} The handler for the interaction, or null if not found.
 */
function getInteractionHandler(interaction) {
    let handlerMap;
    if (interaction.isButton()) {
        handlerMap = buttonHandlers;
    } else if (interaction.isModalSubmit()) {
        handlerMap = modalHandlers;
    } else if (interaction.isAnySelectMenu()) {
        handlerMap = selectMenuHandlers;
    } else {
        return null;
    }

    // Find handler where customId starts with the registered prefix
    for (const [prefix, handler] of handlerMap.entries()) {
        if (interaction.customId.startsWith(prefix)) {
            return handler;
        }
    }

    return null;
}

module.exports = {
    loadInteractionHandlers,
    getInteractionHandler
};
