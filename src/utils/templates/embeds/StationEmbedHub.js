// templates/embeds/StationEmbedHub.js
const { EmbedBuilder } = require('discord.js');
const StationMainEmbed = require('../../../templates/embeds/StationEmbed.js');
const StationTransfersEmbed = require('../../../templates/embeds/stationTransfersEmbed.js');
const StationSurroundingsEmbed = require('../../../templates/embeds/stationSurroundingsEmbed.js');
const StationAccessibilityEmbed = require('../../../templates/embeds/stationAccessibilityEmbed.js');

class StationEmbedHub {
    constructor(metroCore) {
        this.metro = metroCore;
        this.builders = {
            main: new StationMainEmbed(metroCore),
            transfers: new StationTransfersEmbed(metroCore),
            surroundings: new StationSurroundingsEmbed(metroCore),
            accessibility: new StationAccessibilityEmbed(metroCore)
        };
    }

    getAvailableTabs(station) {
        const baseTabs = ['main'];

        if (station.transferLines?.length > 0) {
            baseTabs.push('transfers');
        }

        // Show surroundings if explicit data exists OR no accessDetails
        if ((station.surroundings || station.commerce || station.amenities) ||
            !station.accessDetails) {
            baseTabs.push('surroundings');
        }

        // Add accessibility and sub-tabs if data exists
        if (station.accessDetails || station.accessibility) {
            baseTabs.push('accessibility');

            if (station.accessDetails) {
                baseTabs.push('acc_summary');
                if (station.accessDetails.elevators?.length) baseTabs.push('acc_elevators');
                if (station.accessDetails.escalators?.length) baseTabs.push('acc_escalators');
                if (station.accessDetails.accesses?.length) baseTabs.push('acc_accesses');
            }
        }

        return baseTabs;
    }

    getEmbed(tabId, station, metroData) {
        try {
            // Handle accessibility sub-views
            if (tabId.startsWith('acc_')) {
                return this.builders.accessibility.create(station, tabId);
            }

            // Handle main tabs
            switch(tabId) {
                case 'main':
                    return this.builders.main.create(station, metroData);
                case 'transfers':
                    return this.builders.transfers.create(station, metroData);
                case 'surroundings':
                    return this.builders.surroundings.create(station);
                case 'accessibility':
                    // Default to summary view when clicking main accessibility button
                    return this.builders.accessibility.create(station, 'acc_summary');
                default:
                    return this.builders.main.create(station, metroData);
            }
        } catch (error) {
            console.error(`[EmbedHub] Failed to generate embed for ${tabId}:`, error);
            return this._createErrorEmbed('Failed to load station information');
        }
    }

    _createErrorEmbed(message) {
        return new EmbedBuilder()
            .setTitle('⚠️ Error')
            .setDescription(message)
            .setColor(0xFF0000);
    }

    // Helper methods used by builders
    getLineEmoji(line) {
        const lineKey = line?.toLowerCase();
        return this.metro.config.linesEmojis[lineKey] || '';
    }

    getLineColor(line) {
        const colors = {
            'l1': 0xFF0000, 'l2': 0xFFA500, 'l3': 0xFFD700,
            'l4': 0x0000FF, 'l4a': 0x00CED1, 'l5': 0x008000, 'l6': 0x800080,
        };
        return colors[line?.toLowerCase()] || 0x000000;
    }

    getLineImage(line) {
        return `https://www.metro.cl/images/lines/line-${line || 'default'}.png`;
    }
}

module.exports = StationEmbedHub;
