const fs = require('fs');
const path = require('path');

/**
 * Loads all interaction handlers (buttons, modals, select menus) from their respective directories
 * and stores them in a collection on the client object.
 * @param {import('discord.js').Client} client The Discord client instance.
 */
module.exports = (client) => {
    // This collection will store interaction handlers, keyed by their customId prefix.
    client.interactionHandlers = new Map();

    const interactionsPath = __dirname;
    const interactionTypes = ['buttons', 'modals', 'selectMenus'];

    console.log('[InteractionLoader] Starting to load interaction handlers...');

    for (const type of interactionTypes) {
        const typePath = path.join(interactionsPath, type);

        if (!fs.existsSync(typePath)) {
            continue; // Silently skip if directory doesn't exist.
        }

        const handlerFiles = fs.readdirSync(typePath).filter(file => file.endsWith('.js'));

        for (const file of handlerFiles) {
            const filePath = path.join(typePath, file);
            try {
                const handler = require(filePath);
                // New standard: handler must export a 'customIdPrefix' and an 'execute' function.
                if (handler.customIdPrefix && typeof handler.execute === 'function') {
                    if (client.interactionHandlers.has(handler.customIdPrefix)) {
                        // This prevents conflicts and hard-to-debug issues.
                        console.warn(`[InteractionLoader] ⚠️ DUPLICATE PREFIX: The prefix '${handler.customIdPrefix}' from ${file} is already registered. Skipping.`);
                    } else {
                        client.interactionHandlers.set(handler.customIdPrefix, handler);
                        console.log(`[InteractionLoader] ✅ Loaded ${type.slice(0, -1)} handler with prefix: ${handler.customIdPrefix}`);
                    }
                } else {
                    console.warn(`[InteractionLoader] ⚠️ WARN: The handler at ${filePath} is missing a 'customIdPrefix' or 'execute' function.`);
                }
            } catch (error) {
                console.error(`[InteractionLoader] ❌ ERROR loading handler at ${filePath}:`, error);
            }
        }
    }
    console.log(`[InteractionLoader] Finished loading interaction handlers. ${client.interactionHandlers.size} handlers loaded.`);
};
