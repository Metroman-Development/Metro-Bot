const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ComponentType } = require('discord.js');
const metroConfig = require('../../config/metroConfig');
const logger = require('../../events/logger');

class DisambiguationHandler {
    static async create(interaction, query, matches, resolveCallback, options = {}) {
        if (!interaction || !query || !matches || !resolveCallback) {
            throw new Error('Missing required parameters for disambiguation');
        }

        const {
            maxResults = 5,
            ephemeral = true,
            timeout = 120000,
            title = "Multiple matches found",
            placeholder = "Select the correct option..."
        } = options;

        try {
            // Create UI components
            const embed = this.createDisambiguationEmbed(query, matches, title);
            const selectMenu = this.createSelectionMenu(matches, placeholder, maxResults);
            
            // Send interactive message
            const message = await interaction.reply({
                embeds: [embed],
                components: [new ActionRowBuilder().addComponents(selectMenu)],
                ephemeral,
                fetchReply: true
            });

            // Set up interaction collector
            this.setupInteractionCollector(message, matches, resolveCallback, timeout);
        } catch (error) {
            logger.error('[Disambiguation] Failed to create menu:', error);
            resolveCallback([matches[0]]); // Fallback to first match
        }
    }

    static createDisambiguationEmbed(query, matches, title) {
        const topMatches = matches
            .slice(0, 5)
            .map((match, index) => this.formatMatchForDisplay(match, index + 1))
            .join('\n');

        return new EmbedBuilder()
            .setColor('#FFA500') // Orange from metroConfig could be used here
            .setTitle(title)
            .setDescription(`Your search for "${query}" returned ${matches.length} possible matches.`)
            .addFields({
                name: 'Top matches:',
                value: `${topMatches}${matches.length > 5 ? '\n• ...and more' : ''}`
            })
            .setFooter({ 
                text: `Please select from the menu below • ${new Date().toLocaleTimeString()}` 
            });
    }

    static formatMatchForDisplay(match, index) {
        const lineEmoji = metroConfig.linesEmojis[match.item.line?.toLowerCase()] || 'ℹ️';
        const statusEmoji = metroConfig.statusMapping[match.item.status?.code]?.emoji || '🔵';
        
        let displayText;
        switch(match.type) {
            case 'stations':
                const transferSymbol = match.item.connections?.length > 0 ? ' ↔️' : '';
                displayText = `${statusEmoji} ${lineEmoji} ${match.item.displayName}${transferSymbol}`;
                break;
            case 'lines':
                displayText = `${lineEmoji} ${match.item.displayName}`;
                break;
            case 'trains':
                displayText = `🚄 ${match.item.model} (${match.item.serialNumber}) on ${lineEmoji}`;
                break;
            default:
                displayText = match.item.name || match.id;
        }

        return `**${index}.** ${displayText}`;
    }

    static createSelectionMenu(matches, placeholder, maxResults) {
        return new StringSelectMenuBuilder()
            .setCustomId('disambiguation_menu')
            .setPlaceholder(placeholder)
            .addOptions(
                matches.slice(0, 25).map(match => ({
                    label: this.truncateText(match.item.displayName || match.item.name || match.id, 25),
                    description: this.generateOptionDescription(match),
                    value: match.id,
                    emoji: this.getMatchEmoji(match)
                }))
            );
    }

    static generateOptionDescription(match) {
        switch(match.type) {
            case 'stations':
                return `Line ${match.item.line?.toUpperCase()} • ${match.item.commune || 'Santiago'}`;
            case 'lines':
                return `${match.item.stations?.length || '?'} stations`;
            case 'trains':
                return `Model: ${match.item.model}`;
            default:
                return 'Match';
        }
    }

    static getMatchEmoji(match) {
        if (match.item.line) {
            const lineCode = match.item.line.toLowerCase();
            return metroConfig.linesEmojis[lineCode] ? 
                { id: metroConfig.linesEmojis[lineCode].match(/[0-9]+/)[0] } : 
                'ℹ️';
        }
        return '🔍';
    }

    static setupInteractionCollector(message, matches, resolveCallback, timeout) {
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: timeout,
            filter: i => i.customId === 'disambiguation_menu' && 
                       i.user.id === message.interaction.user.id
        });

        collector.on('collect', async interaction => {
            try {
                await interaction.deferUpdate();
                const selectedId = interaction.values[0];
                const selectedMatch = matches.find(m => m.id === selectedId);
                
                if (selectedMatch) {
                    resolveCallback([selectedMatch]);
                }
            } catch (error) {
                logger.error('[Disambiguation] Selection error:', error);
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                message.edit({
                    components: [],
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#FF0000')
                            .setDescription('⏰ Selection timed out. Please try your search again.')
                    ]
                }).catch(() => {});
            }
        });
    }

    static truncateText(text, maxLength) {
        return text.length > maxLength ? 
            text.substring(0, maxLength - 3) + '...' : 
            text;
    }
}

module.exports = DisambiguationHandler;