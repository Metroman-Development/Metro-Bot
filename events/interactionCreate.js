/*const { Events } = require('discord.js');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const { getCache, cache } = require('../utils/cache');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
            // Skip cache check for autocomplete interactions
            if (!interaction.isAutocomplete()) {
                // Get the relevant identifier based on interaction type
                let interactionIdentifier;
                
                if (interaction.isCommand() || interaction.isContextMenuCommand()) {
                    interactionIdentifier = interaction.commandName;
                } else if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
                    interactionIdentifier = interaction.customId.split('_')[0];
                }

                if (interactionIdentifier) {
                    // Check if any cache entry exists for this interaction
                    const allCacheEntries = Array.from(cache.entries());
                    const cacheEntry = allCacheEntries.find(([key]) => 
                        key.endsWith(`_${interactionIdentifier}`)
                    );

                    if (cacheEntry) {
                        const [cacheKey] = cacheEntry;
                        const cacheUserId = cacheKey.split('_')[0];
                        
                        // If current user doesn't match cache user
                        if (cacheUserId !== interaction.user.id) {
                            if (!interaction.replied && !interaction.deferred) {
                                await interaction.reply({
                                    content: '⚠️ Tu no invocaste este comando',
                                    ephemeral: true
                                });
                            } else {
                                await interaction.followUp({
                                    content: '⚠️ Tu no invocaste este comando',
                                    ephemeral: true
                                });
                            }
                            return;
                        }
                    }
                }
            }

            // Dynamically load button handlers
            if (interaction.isButton()) {
                const buttonsPath = path.join(__dirname, 'interactionUI', 'buttons');
                if (!fs.existsSync(buttonsPath)) {
                    console.error('❌ Buttons directory does not exist:', buttonsPath);
                    return;
                }

                const buttonFiles = fs.readdirSync(buttonsPath).filter(file => file.endsWith('.js'));
                
                for (const file of buttonFiles) {
                    const buttonModule = require(path.join(buttonsPath, file));
                    
                    const handlers = Array.isArray(buttonModule) ? buttonModule : 
                                    (buttonModule.default ? [buttonModule.default] : [buttonModule]);
                    
                    for (const button of handlers) {
                        if (interaction.customId.startsWith(button.customId)) {
                            try {
                                if (!interaction.deferred && !interaction.replied) {
                                    await interaction.deferUpdate();
                                }
                                await button.execute(interaction, client);
                                return;
                            } catch (error) {
                                console.error(`❌ Error executing button handler ${button.customId}:`, error);
                                try {
                                    if (!interaction.replied && !interaction.deferred) {
                                        await interaction.followUp({
                                            content: '❌ Ocurrió un error al procesar esta interacción',
                                            ephemeral: true
                                        });
                                    } else {
                                        await interaction.followUp({
                                            content: '❌ Ocurrió un error al procesar esta interacción',
                                            ephemeral: true
                                        });
                                    }
                                } catch (err) {
                                    console.error('❌ Error sending error message:', err);
                                }
                            }
                        }
                    }
                }
                
                console.warn(`⚠️ No button handler found for customId: ${interaction.customId}`);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.followUp({
                        content: '⚠️ Esta acción ya no está disponible',
                        ephemeral: true
                    });
                }
            }

            // Dynamically load select menu handlers
            if (interaction.isStringSelectMenu()) {
                const selectMenusPath = path.join(__dirname, 'interactionUI', 'selectMenus');
                if (!fs.existsSync(selectMenusPath)) {
                    console.error('❌ Select menus directory does not exist:', selectMenusPath);
                    return;
                }

                const selectMenuFiles = fs.readdirSync(selectMenusPath).filter(file => file.endsWith('.js'));
                for (const file of selectMenuFiles) {
                    const selectMenu = require(path.join(selectMenusPath, file));
                    if (interaction.customId.startsWith(selectMenu.customId)) {
                        if (!interaction.deferred && !interaction.replied) {
                            await interaction.deferUpdate();
                        }
                        await selectMenu.execute(interaction, client);
                        return;
                    }
                }
            }

            // Handle slash commands
            if (interaction.isCommand()) {
                const slashCommandsPath = path.join(__dirname, '..', 'slashCommands');
                if (!fs.existsSync(slashCommandsPath)) {
                    logger.error('❌ Slash commands directory does not exist:', slashCommandsPath);
                    return;
                }

                const slashCommandFiles = fs.readdirSync(slashCommandsPath).filter(file => file.endsWith('.js'));
                for (const file of slashCommandFiles) {
                    const command = require(path.join(slashCommandsPath, file));
                    if (interaction.commandName === command.data.name) {
                        if (!interaction.deferred && !interaction.replied) {
                            await interaction.deferReply();
                        }
                        await command.execute(interaction, client);
                        return;
                    }
                }
            }

            // Handle modals
            if (interaction.isModalSubmit()) {
                const modalsPath = path.join(__dirname, 'interactionUI', 'modals');
                if (!fs.existsSync(modalsPath)) {
                    console.error('❌ Modals directory does not exist:', modalsPath);
                    return;
                }

                const modalFiles = fs.readdirSync(modalsPath).filter(file => file.endsWith('.js'));
                for (const file of modalFiles) {
                    const modal = require(path.join(modalsPath, file));
                    if (interaction.customId === modal.customId) {
                        if (!interaction.deferred && !interaction.replied) {
                            await interaction.deferReply();
                        }
                        await modal.execute(interaction, client);
                        return;
                    }
                }
            }

            // Handle context menus
            if (interaction.isContextMenuCommand()) {
                const contextMenusPath = path.join(__dirname, 'interactionUI', 'contextMenus');
                if (!fs.existsSync(contextMenusPath)) {
                    console.error('❌ Context menus directory does not exist:', contextMenusPath);
                    return;
                }

                const contextMenuFiles = fs.readdirSync(contextMenusPath).filter(file => file.endsWith('.js'));
                for (const file of contextMenuFiles) {
                    const contextMenu = require(path.join(contextMenusPath, file));
                    if (interaction.commandName === contextMenu.data.name) {
                        if (!interaction.deferred && !interaction.replied) {
                            await interaction.deferReply();
                        }
                        await contextMenu.execute(interaction, client);
                        return;
                    }
                }
            }

            // Handle autocomplete interactions
            if (interaction.isAutocomplete()) {
                const autocompletePath = path.join(__dirname, 'interactionUI', 'autocomplete');
                if (!fs.existsSync(autocompletePath)) {
                    console.error('❌ Autocomplete directory does not exist:', autocompletePath);
                    return;
                }

                const autocompleteFiles = fs.readdirSync(autocompletePath).filter(file => file.endsWith('.js'));
                for (const file of autocompleteFiles) {
                    const autocomplete = require(path.join(autocompletePath, file));
                    if (interaction.commandName === autocomplete.commandName) {
                        await autocomplete.execute(interaction, client);
                        return;
                    }
                }
            }

        } catch (error) {
            console.error('❌ Error handling interaction:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({ content: '❌ Ocurrió un error al procesar la interacción.', ephemeral: true });
            } else {
                await interaction.reply({ content: '❌ Ocurrió un error al procesar la interacción.', ephemeral: true });
            }
        }
    },
};*/