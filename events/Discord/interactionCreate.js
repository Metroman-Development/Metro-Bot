/*onst { Events } = require('discord.js');
const path = require('path');
const fs = require('fs');
const logger = require('../logger');
const CacheManager = require('../../core/cache/CacheManager');
const { getClient} = require('../../utils/clientManager');


// Initialize new cache system
const cache = new CacheManager();

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
            // Skip cache check for autocomplete interactions
            if (!interaction.isAutocomplete()) {
                const interactionIdentifier = getInteractionIdentifier(interaction);
                if (interactionIdentifier) await verifyInteractionOwner(interaction, interactionIdentifier);
            }

            // Handle different interaction types
            if (interaction.isButton()) {
                await handleButton(interaction, client);
            } else if (interaction.isStringSelectMenu()) {
                await handleSelectMenu(interaction, client);
            } else if (interaction.isCommand()) {
                await handleSlashCommand(interaction, client);
            } else if (interaction.isModalSubmit()) {
                await handleModal(interaction, client);
            } else if (interaction.isContextMenuCommand()) {
                await handleContextMenu(interaction, client);
            } else if (interaction.isAutocomplete()) {
                await handleAutocomplete(interaction, client);
            }

        } catch (error) {
            logger.error('INTERACTION_HANDLER_ERROR', {
                error: error.message,
                stack: error.stack,
                interactionType: interaction.type,
                customId: interaction.customId || interaction.commandName
            });
            
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({ 
                    content: '❌ An error occurred while processing this interaction', 
                    ephemeral: true 
                });
            } else {
                await interaction.editReply({ 
                    content: '❌ An error occurred while processing this interaction', 
                    ephemeral: true 
                });
            }
        }
    }
};

// Helper functions
function getInteractionIdentifier(interaction) {
    if (interaction.isCommand() || interaction.isContextMenuCommand()) {
        return interaction.commandName;
    } else if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
        return interaction.customId.split('_')[0];
    }
    return null;
}

async function verifyInteractionOwner(interaction, identifier) {
    try {
        const cacheKey = `interaction:${interaction.user.id}_${identifier}`;
        const cachedValue = await cache.get('interaction_ownership', cacheKey);
        
        if (cachedValue) {
            const cacheUserId = cachedValue.userId;
            
            if (cacheUserId !== interaction.user.id) {
                throw new Error(`User ${interaction.user.id} attempted to use interaction owned by ${cacheUserId}`);
            }
        }
    } catch (error) {
        logger.error('CACHE_VERIFICATION_ERROR', {
            error: error.message,
            stack: error.stack,
            interactionId: identifier
        });
        throw error;
    }
}

// Interaction type handlers
async function handleButton(interaction, client) {
    const buttonsPath = path.join(__dirname, './interactions/buttons'); 
                               
    const buttonFiles = getInteractionFiles(buttonsPath);

    for (const file of buttonFiles) {
        const button = require(path.join(buttonsPath, file));
        if (interaction.customId.startsWith(button.customId)) {
            await executeInteraction(interaction, button, { deferUpdate: true });
            return;
        }
    }

    throw new Error(`No button handler found for: ${interaction.customId}`);
}

async function handleSelectMenu(interaction, client) {
    const selectMenusPath = path.join(__dirname, './interactions/selectMenus');
                                      
                                     
    const selectMenuFiles = getInteractionFiles(selectMenusPath);

    for (const file of selectMenuFiles) {
        const menu = require(path.join(selectMenusPath, file));
        if (interaction.customId.startsWith(menu.customId)) {
            await executeInteraction(interaction, menu, { deferUpdate: true });
            return;
        }
    }

    throw new Error(`No select menu handler found for: ${interaction.customId}`);
}

async function handleSlashCommand(interaction, client) {
    if (!client){
        client = getClient() ;
    } 
    const command = client.commands.get(interaction.commandName);
    if (!command) throw new Error(`Command not found: ${interaction.commandName}`);

    await executeInteraction(interaction, command, { deferReply: true });
}

async function handleModal(interaction, client) {
    const modalsPath = path.join(__dirname, './interactions/modals');
    const modalFiles = getInteractionFiles(modalsPath);

    for (const file of modalFiles) {
        const modal = require(path.join(modalsPath, file));
        if (interaction.customId === modal.customId) {
            await executeInteraction(interaction, modal, { deferReply: true });
            return;
        }
    }

    throw new Error(`No modal handler found for: ${interaction.customId}`);
}

async function handleContextMenu(interaction, client) {
    const contextMenusPath = path.join(__dirname, './interactions/contextMenus');
    const contextMenuFiles = getInteractionFiles(contextMenusPath);

    for (const file of contextMenuFiles) {
        const contextMenu = require(path.join(contextMenusPath, file));
        if (interaction.commandName === contextMenu.data.name) {
            await executeInteraction(interaction, contextMenu, { deferReply: true });
            return;
        }
    }

    throw new Error(`No context menu handler found for: ${interaction.commandName}`);
}

async function handleAutocomplete(interaction, client) {
    const autocompletePath = path.join(__dirname, './interactions/autocomplete');
    const autocompleteFiles = getInteractionFiles(autocompletePath);

    for (const file of autocompleteFiles) {
        const autocomplete = require(path.join(autocompletePath, file));
        if (interaction.commandName === autocomplete.commandName) {
            await autocomplete.execute(interaction, client);
            return;
        }
    }

    throw new Error(`No autocomplete handler found for: ${interaction.commandName}`);
}

// Utility functions
function getInteractionFiles(dirPath) {
    if (!fs.existsSync(dirPath)) {
        logger.error(`Directory does not exist: ${dirPath}`);
        return [];
    }
    return fs.readdirSync(dirPath).filter(file => file.endsWith('.js'));
}

async function executeInteraction(interaction, handler, options = {}) {
    
    client = getClient() ;
    
    if (!interaction.deferred && !interaction.replied) {
        if (options.deferUpdate) await interaction.deferUpdate();
        if (options.deferReply) await interaction.deferReply();
    }

    await handler.execute(interaction, client);
    logger.info('INTERACTION_EXECUTED', {
        type: interaction.type,
        name: handler.customId || handler.data?.name || 'unknown',
        user: interaction.user.tag,
        guild: interaction.guild?.name || 'DM'
    });
}

// Cache utility functions
async function storeInteraction(userId, interactionId, data = {}) {
    const cacheKey = `interaction:${userId}_${interactionId}`;
    await cache.set(
        'interaction_ownership',
        cacheKey,
        { userId, ...data },
        900000 // 15 minute TTL
    );
}

async function getCachedInteraction(userId, interactionId) {
    const cacheKey = `interaction:${userId}_${interactionId}`;
    return await cache.get('interaction_ownership', cacheKey);
}

// Export cache utilities if needed by other modules
module.exports.cacheUtils = {
    storeInteraction,
    getCachedInteraction
};*/