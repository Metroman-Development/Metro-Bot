// templates/embeds/baseEmbed.js
// templates/embeds/baseEmbed.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const { STATUS_CODES } = require('../../modules/status/config/statusConfig');
const { lineProcessing, stationFormatting } = require('../../modules/metro/utils/stringHandlers');

class BaseEmbed {
    constructor(metroCore = null) {
        this.styles = require('../../config/metro/styles.json');
        this.metro = metroCore;
        this.statusConfig = STATUS_CODES;
        this.utils = {
            string: {
                normalize: text => stationFormatting.normalizeName(text),
                generateId: (name, line) => stationFormatting.generateStationId(name, line)
            },
            line: {
                getColor: lineKey => lineProcessing.getLineColor(lineKey),
                formatName: lineKey => lineProcessing.formatDisplayName(lineKey)
            }
        };
    }

    createEmbed(data) {
        const embed = new EmbedBuilder()
            .setTitle(data.title || '')
            .setDescription(data.description || '')
            .setColor(data.color || this.styles.defaultTheme.primaryColor);

        if (data.fields) embed.addFields(data.fields);
        if (data.image) embed.setImage(data.image);
        if (data.thumbnail) embed.setThumbnail(data.thumbnail);
        if (data.footer) embed.setFooter(data.footer);
        if (data.timestamp !== false) embed.setTimestamp();

        return embed;
    }

    createButton(customId, label, style = 'Primary', options = {}) {
        const button = new ButtonBuilder()
            .setCustomId(customId)
            .setLabel(label)
            .setStyle(ButtonStyle[style]);

        if (options.emoji) button.setEmoji(options.emoji);
        if (options.disabled) button.setDisabled(options.disabled);
        return button;
    }

    createActionRow(components) {
        return new ActionRowBuilder().addComponents(
            Array.isArray(components) ? components : [components]
        );
    }

    paginate(items, currentPage, itemsPerPage = 10) {
        const totalPages = Math.ceil(items.length / itemsPerPage);
        const paginatedItems = items.slice(
            (currentPage - 1) * itemsPerPage,
            currentPage * itemsPerPage
        );

        return {
            items: paginatedItems,
            currentPage,
            totalPages,
            hasNext: currentPage < totalPages,
            hasPrev: currentPage > 1
        };
    }

    getStatusDisplay(statusCode) {
        return {
            emoji: this.statusConfig[statusCode]?.emoji || '❓',
            color: this.statusConfig[statusCode]?.color || '#95a5a6',
            text: this.statusConfig[statusCode]?.name || 'Desconocido'
        };
    }

    formatStationName(station) {
        return `${this.getStatusDisplay(station.status).emoji} ${station.name} (${station.line.toUpperCase()})`;
    }
}

module.exports = BaseEmbed;