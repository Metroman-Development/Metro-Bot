const { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, ComponentType, StringSelectMenuBuilder } = require('discord.js');
// Add to the existing imports at the top of DisambiguationHandler.js


const metroConfig = require('../../../config/metro/metroConfig');
const logger = require('../../../events/logger');
const SingleSelectButton = require('./templates/singleSelectButton');

class DisambiguationHandler {
    static async create(interaction, query, matches, resolveCallback, options = {}) {
        const {
            maxResults = 5,
            ephemeral = true,
            timeout = 120000,
            title = "Multiple matches found",
            useButtons = true // New config flag
        } = options;

        try {
            if(useButtons) {
                return this.createButtonVersion(interaction, query, matches, resolveCallback, options);
            }
            return this.createSelectMenuVersion(interaction, query, matches, resolveCallback, options);
        } catch (error) {
            logger.error('[Disambiguation] Failed to create menu:', error);
            resolveCallback([matches[0]]);
        }
    }

    //============== BUTTON VERSION ==============//
    static async createButtonVersion(interaction, query, matches, resolveCallback, options) {
        const buttonHandler = new SingleSelectButton({
            customIdPrefix: 'disambig_btn',
            selectedStyle: ButtonStyle.Primary,
            deselectedStyle: ButtonStyle.Secondary,
            timeout: options.timeout,
            options: matches.slice(0, 5).map(match => ({
                id: match.id,
                label: this.formatMatchLabel(match)
            }))
        });

        const embed = this.createButtonEmbed(query, matches, options.title);
        
        const message = await interaction.reply({
            embeds: [embed],
            components: [await buttonHandler.build()],
            ephemeral: options.ephemeral,
            fetchReply: true
        });

        this.setupButtonCollector(message, buttonHandler, matches, resolveCallback, options.timeout);
        return message;
    }

    static createButtonEmbed(query, matches, title) {
        return new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle(title)
            .setDescription(`Your search for **"${query}"** found ${matches.length} matches.`)
            .addFields({
                name: 'Top Results:',
                value: matches.slice(0, 5)
                    .map((m, i) => `**${i+1}.** ${this.formatMatchLabel(m)}`)
                    .join('\n')
            })
            .setFooter({ text: 'Click a button to select • Timeout: 2 minutes' });
    }

    static setupButtonCollector(message, handler, matches, resolveCallback, timeout) {
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: timeout
        });

        collector.on('collect', async i => {
            await handler.handleInteraction(i);
            const selectedId = handler.getCurrentSelection(i.user.id);
            if(selectedId) resolveCallback([matches.find(m => m.id === selectedId)]);
        });

        collector.on('end', () => this.handleTimeout(message, matches, resolveCallback));
    }

    //============== SELECT MENU VERSION ==============//
    static async createSelectMenuVersion(interaction, query, matches, resolveCallback, options) {
        const embed = this.createMenuEmbed(query, matches, options.title);
        const menu = this.createSelectionMenu(matches);
        
        const message = await interaction.reply({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: options.ephemeral,
            fetchReply: true
        });

        this.setupMenuCollector(message, matches, resolveCallback, options.timeout);
        return message;
    }

    static createMenuEmbed(query, matches, title) {
        return new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle(title)
            .setDescription(`Your search for **"${query}"** found ${matches.length} matches.`)
            .setFooter({ text: 'Use the dropdown to select • Timeout: 2 minutes' });
    }

    static createSelectionMenu(matches) {
        return new StringSelectMenuBuilder()
            .setCustomId('disambiguation_menu')
            .setPlaceholder('Select the correct option...')
            .addOptions(matches.slice(0, 25).map(m => ({
                label: this.truncateText(m.item.displayName, 25),
                description: this.generateOptionDescription(m),
                value: m.id,
                emoji: this.getMatchEmoji(m)
            })));
    }

    static setupMenuCollector(message, matches, resolveCallback, timeout) {
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: timeout
        });

        collector.on('collect', async i => {
            const selectedId = i.values[0];
            resolveCallback([matches.find(m => m.id === selectedId)]);
            await i.deferUpdate();
        });

        collector.on('end', () => this.handleTimeout(message, matches, resolveCallback));
    }

    //============== SHARED UTILITIES ==============//
    static formatMatchLabel(match) {
        const lineEmoji = metroConfig.linesEmojis[match.item.line?.toLowerCase()] || 'ℹ️';
        const statusEmoji = metroConfig.statusMapping[match.item.status?.code]?.emoji || '🔵';
        
        switch(match.type) {
            case 'stations':
                return `${statusEmoji} ${lineEmoji} ${match.item.displayName}`;
            case 'lines':
                return `${lineEmoji} ${match.item.displayName}`;
            case 'trains':
                return `🚄 ${match.item.model} (${match.item.serialNumber})`;
            default:
                return match.item.name || match.id;
        }
    }

    static handleTimeout(message, matches, resolveCallback) {
        if(matches.length > 0) {
            message.edit({
                components: [],
                embeds: [
                    new EmbedBuilder()
                        .setColor('#FF0000')
                        .setDescription('⏰ Selection timed out. Using first match.')
                ]
            }).catch(() => {});
            resolveCallback([matches[0]]);
        }
    }

    static truncateText(text, maxLength) {
        return text.length > maxLength ? 
            text.substring(0, max-3) + '...' : text;
    }

    static generateOptionDescription(match) {
        switch(match.type) {
            case 'stations': 
                return `Line ${match.item.line} • ${match.item.commune}`;
            case 'lines': 
                return `${match.item.stations?.length} stations`;
            default: 
                return 'Select match';
        }
    }

    static getMatchEmoji(match) {
        return metroConfig.linesEmojis[match.item.line?.toLowerCase()]? 
            { id: metroConfig.linesEmojis[match.item.line].match(/[0-9]+/)[0] } : 
            '🔍';
    }
}

module.exports = DisambiguationHandler;