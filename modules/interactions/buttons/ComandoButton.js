const { EmbedBuilder, ActionRowBuilder, ButtonStyle, ButtonBuilder } = require('discord.js');
const BaseButton = require('./templates/baseButton');
const interactionStore = require('../utils/interactionStore');
const styles = require('../../../config/metro/styles.json');

class ComandoButton extends BaseButton {
    constructor() {
        super({
            customIdPrefix: 'comando',
            style: ButtonStyle.Secondary
        });
        this.cacheDuration = 60 * 60 * 1000; // 1 hour cache
        
        // Color mappings using the existing styles.json
        this.viewColors = {
            category: styles.defaultTheme.infoColor,
            command: styles.defaultTheme.primaryColor,
            subcommand: styles.routeColors.comun,
            search: styles.routeColors.verde,
            error: styles.defaultTheme.errorColor,
            success: styles.defaultTheme.successColor
        };
    }

    async buildCategoryView(client, activeCategory = null) {
        const categories = this._getCommandCategories(client);
        activeCategory = activeCategory || categories[0]?.id;
        
        const cacheKey = `cmd_categories`;
        const cacheData = {
            type: 'category',
            categories,
            activeCategory,
            commands: this._getCommandsByCategory(client, activeCategory),
            timestamp: Date.now()
        };

        interactionStore.set(cacheKey, cacheData, this.cacheDuration);
        return this._createCategoryMessage(cacheData);
    }

    async buildCommandView(commandName, client) {
        const command = this._findCommand(client, commandName);
        if (!command) throw new Error('Command not found');

        const cacheKey = `cmd_${commandName}`;
        const cacheData = {
            type: 'command',
            command: this._enrichCommandData(command, client),
            timestamp: Date.now()
        };

        interactionStore.set(cacheKey, cacheData, this.cacheDuration);
        return this._createCommandMessage(cacheData);
    }

    async buildSearchView(results, searchTerm) {
        const cacheKey = `cmd_search_${searchTerm.toLowerCase()}`;
        const cacheData = {
            type: 'search',
            results,
            searchTerm,
            timestamp: Date.now()
        };

        interactionStore.set(cacheKey, cacheData, this.cacheDuration);
        return this._createSearchMessage(cacheData);
    }

    async handleInteraction(interaction, metadata) {
        const [_, action, identifier] = interaction.customId.split(':');
        
        try {
            let cacheData;
            switch(action) {
                case 'category':
                    cacheData = await this._handleCategoryInteraction(interaction, identifier);
                    break;
                case 'command':
                    cacheData = await this._handleCommandInteraction(interaction, identifier);
                    break;
                case 'subcommand':
                    cacheData = await this._handleSubcommandInteraction(interaction, identifier);
                    break;
                case 'search':
                    cacheData = await this._handleSearchInteraction(interaction, identifier);
                    break;
                case 'show_all':
                    cacheData = await this._handleShowAllInteraction(interaction);
                    break;
                default:
                    return this._sendError(interaction, 'Acción no válida');
            }

            await interaction.editReply(this._createMessage(cacheData));
        } catch (error) {
            console.error('Failed to handle interaction:', error);
            await this._sendError(interaction, 'Error al procesar la interacción');
        }
    }

    _createMessage(data) {
        switch(data.type) {
            case 'category': return this._createCategoryMessage(data);
            case 'command': return this._createCommandMessage(data);
            case 'subcommand': return this._createSubcommandMessage(data);
            case 'search': return this._createSearchMessage(data);
            default: return this._createCategoryMessage(data);
        }
    }

    _createCategoryMessage(data) {
        const { categories, activeCategory, commands } = data;
        const activeCat = categories.find(c => c.id === activeCategory);

        const embed = new EmbedBuilder()
            .setTitle('📚 Todos los Comandos')
            .setDescription(`Categoría: **${activeCat?.name || 'General'}** (${commands.length} comandos)`)
            .setColor(this.viewColors.category);

        if (commands.length > 0) {
            const chunkSize = 5;
            for (let i = 0; i < commands.length; i += chunkSize) {
                embed.addFields({
                    name: '\u200B',
                    value: commands.slice(i, i + chunkSize)
                        .map(cmd => {
                            if (cmd.isSubcommand) {
                                return `\`/${cmd.parentCommand} ${cmd.data.name}\` - ${cmd.data.description}`;
                            }
                            return `\`/${cmd.data.name}\` - ${cmd.data.description}`;
                        })
                        .join('\n'),
                    inline: false
                });
            }
        } else {
            embed.setDescription('No hay comandos en esta categoría');
        }

        const categoryRows = [];
        for (let i = 0; i < categories.length; i += 5) {
            categoryRows.push(new ActionRowBuilder().addComponents(
                categories.slice(i, i + 5).map(cat => 
                    new ButtonBuilder()
                        .setCustomId(`comando:category:${cat.id}`)
                        .setLabel(cat.name)
                        .setStyle(cat.id === activeCategory ? ButtonStyle.Primary : ButtonStyle.Secondary)
                        .setDisabled(cat.id === activeCategory)
                )
            ));
        }

        const showAllButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('comando:show_all:all')
                .setLabel('Ver todos los comandos')
                .setStyle(ButtonStyle.Secondary)
        );

        return {
            embeds: [embed],
            components: [...categoryRows, showAllButton]
        };
    }

    _createCommandMessage(data) {
        const { command } = data;
        const embed = new EmbedBuilder()
            .setTitle(`ℹ️ /${command.data.name}`)
            .setColor(this.viewColors.command)
            .setDescription(command.data.description || 'Sin descripción')
            .addFields(
                { name: '📂 Categoría', value: command.category || 'General', inline: true },
                { name: '⏱️ Cooldown', value: `${command.cooldown || 3}s`, inline: true }
            );

        if (command.subcommands?.size > 0) {
            const subcommands = Array.from(command.subcommands.values())
                .map(sub => `• \`${sub.data.name}\` - ${sub.data.description || 'Sin descripción'}`)
                .join('\n');
            
            embed.addFields({
                name: `🔹 Subcomandos (${command.subcommands.size})`,
                value: subcommands
            });
        }

        const rows = [];
        const backButton = new ButtonBuilder()
            .setCustomId(`comando:category:${command.category?.toLowerCase().replace(/\s+/g, '-') || 'general'}`)
            .setLabel('Volver a categorías')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('↩️');

        rows.push(new ActionRowBuilder().addComponents(backButton));

        if (command.subcommands?.size > 0) {
            const subcommandButtons = Array.from(command.subcommands.values())
                .slice(0, 5)
                .map(sub => 
                    new ButtonBuilder()
                        .setCustomId(`comando:subcommand:${command.data.name}_${sub.data.name}`)
                        .setLabel(sub.data.name)
                        .setStyle(ButtonStyle.Secondary)
                );
            
            rows.push(new ActionRowBuilder().addComponents(subcommandButtons));
        }

        return { embeds: [embed], components: rows };
    }

    _createSubcommandMessage(data) {
        const [commandName, subcommandName] = data.commandName.split('_');
        const command = data.parentCommand;
        const subcommand = command.subcommands.get(subcommandName);

        const embed = new EmbedBuilder()
            .setTitle(`🔹 /${commandName} ${subcommandName}`)
            .setColor(this.viewColors.subcommand)
            .setDescription(subcommand.data.description || 'Sin descripción')
            .addFields(
                { name: '📂 Categoría', value: subcommand.category || command.category || 'General', inline: true },
                { name: '⏱️ Cooldown', value: `${subcommand.cooldown || command.cooldown || 3}s`, inline: true }
            );

        if (subcommand.config?.usage) {
            embed.addFields({
                name: '💡 Ejemplo',
                value: subcommand.config.usage
            });
        }

        const backButton = new ButtonBuilder()
            .setCustomId(`comando:command:${commandName}`)
            .setLabel(`Volver a /${commandName}`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('↩️');

        return {
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(backButton)]
        };
    }

    _createSearchMessage(data) {
        const { results, searchTerm } = data;
        const embed = new EmbedBuilder()
            .setTitle(`🔍 Resultados para "${searchTerm}" (${results.length})`)
            .setColor(this.viewColors.search);

        if (results.length > 0) {
            const chunkSize = 5;
            for (let i = 0; i < results.length; i += chunkSize) {
                embed.addFields({
                    name: '\u200B',
                    value: results.slice(i, i + chunkSize)
                        .map(cmd => {
                            if (cmd.isSubcommand) {
                                return `\`/${cmd.parentCommand} ${cmd.name.replace(`${cmd.parentCommand} `, '')}\` - ${cmd.description}`;
                            }
                            return `\`/${cmd.name}\` - ${cmd.description}`;
                        })
                        .join('\n'),
                    inline: false
                });
            }
        } else {
            embed.setDescription('No se encontraron resultados');
        }

        const backButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('comando:category:general')
                .setLabel('Volver a categorías')
                .setStyle(ButtonStyle.Secondary)
        );

        return {
            embeds: [embed],
            components: [backButton]
        };
    }

    async _handleCategoryInteraction(interaction, categoryId) {
        const client = interaction.client;
        const cacheKey = `cmd_categories`;
        let cacheData = interactionStore.get(cacheKey);

        if (!cacheData || cacheData.type !== 'category') {
            cacheData = {
                type: 'category',
                categories: this._getCommandCategories(client),
                activeCategory: categoryId,
                commands: this._getCommandsByCategory(client, categoryId),
                timestamp: Date.now()
            };
        } else {
            cacheData = {
                ...cacheData,
                activeCategory: categoryId,
                commands: this._getCommandsByCategory(client, categoryId),
                timestamp: Date.now()
            };
        }

        interactionStore.set(cacheKey, cacheData, this.cacheDuration);
        return cacheData;
    }

    async _handleCommandInteraction(interaction, commandName) {
        const command = this._findCommand(interaction.client, commandName);
        if (!command) throw new Error('Command not found');

        const cacheKey = `cmd_${commandName}`;
        const cacheData = {
            type: 'command',
            command: this._enrichCommandData(command, interaction.client),
            timestamp: Date.now()
        };

        interactionStore.set(cacheKey, cacheData, this.cacheDuration);
        return cacheData;
    }

    async _handleSubcommandInteraction(interaction, fullCommandName) {
        const [commandName, subcommandName] = fullCommandName.split('_');
        const command = this._findCommand(interaction.client, commandName);
        if (!command) throw new Error('Parent command not found');

        const subcommand = command.subcommands?.get(subcommandName);
        if (!subcommand) throw new Error('Subcommand not found');

        const cacheKey = `cmd_sub_${fullCommandName}`;
        const cacheData = {
            type: 'subcommand',
            commandName: fullCommandName,
            parentCommand: command,
            subcommand: this._enrichCommandData(subcommand, interaction.client),
            timestamp: Date.now()
        };

        interactionStore.set(cacheKey, cacheData, this.cacheDuration);
        return cacheData;
    }

    async _handleSearchInteraction(interaction, searchTerm) {
        const cacheKey = `cmd_search_${searchTerm.toLowerCase()}`;
        const cacheData = interactionStore.get(cacheKey);

        if (!cacheData || cacheData.type !== 'search') {
            throw new Error('Search results not found in cache');
        }

        // Refresh cache
        interactionStore.set(cacheKey, {
            ...cacheData,
            timestamp: Date.now()
        }, this.cacheDuration);

        return cacheData;
    }

    async _handleShowAllInteraction(interaction) {
        const client = interaction.client;
        const commands = this._getCommandsByCategory(client, 'all');

        return {
            type: 'category',
            categories: this._getCommandCategories(client),
            activeCategory: 'all',
            commands,
            timestamp: Date.now()
        };
    }

    _getCommandCategories(client) {
        const categories = new Set(['General']);
        client.commands.forEach(cmd => {
            if (cmd.category) categories.add(cmd.category);
            if (cmd.subcommands) {
                cmd.subcommands.forEach(subCmd => {
                    if (subCmd.category) categories.add(subCmd.category);
                });
            }
        });

        return Array.from(categories).map(cat => ({
            id: cat.toLowerCase().replace(/\s+/g, '-'),
            name: cat
        }));
    }

    _getCommandsByCategory(client, categoryId) {
        if (categoryId === 'all') {
            const allCommands = [];
            
            // Add all main commands
            Array.from(client.commands.values()).forEach(cmd => {
                allCommands.push(cmd);
                
                // Add all subcommands
                if (cmd.subcommands) {
                    Array.from(cmd.subcommands.values()).forEach(subCmd => {
                        allCommands.push({
                            ...subCmd,
                            isSubcommand: true,
                            parentCommand: cmd.data.name
                        });
                    });
                }
            });
            
            return allCommands;
        }

        const categoryName = this._getCommandCategories(client)
            .find(c => c.id === categoryId)?.name;
        
        if (!categoryName) return [];

        const commands = [];
        
        // Add main commands in this category
        Array.from(client.commands.values()).forEach(cmd => {
            // Add parent command if it matches the category
            if (cmd.category === categoryName) {
                commands.push(cmd);
            }
            
            // Add subcommands that match the category
            if (cmd.subcommands) {
                Array.from(cmd.subcommands.values()).forEach(subCmd => {
                    if (subCmd.category === categoryName) {
                        commands.push({
                            ...subCmd,
                            isSubcommand: true,
                            parentCommand: cmd.data.name
                        });
                    }
                });
            }
        });

        return commands;
    }

    _findCommand(client, commandName) {
        return client.commands.get(commandName) || 
               Array.from(client.commands.values())
                   .find(cmd => cmd.subcommands?.has(commandName));
    }

    _enrichCommandData(command, client) {
        return {
            ...command,
            config: command.config || {},
            category: command.category || 'General',
            cooldown: command.cooldown || 3
        };
    }

    async _sendError(interaction, message) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('⚠️ Error')
                .setDescription(message)
                .setColor(this.viewColors.error);

            const content = { embeds: [embed], ephemeral: true };
            
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(content);
            } else {
                await interaction.reply(content);
            }
        } catch (error) {
            console.error('Failed to send error:', error);
        }
    }
}

module.exports = ComandoButton;