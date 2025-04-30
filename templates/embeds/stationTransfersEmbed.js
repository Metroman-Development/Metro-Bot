// templates/embeds/stationTransfersEmbed.js
const { EmbedBuilder } = require('discord.js');
const BaseEmbed = require('./baseEmbed');

class StationTransfersEmbed extends BaseEmbed {
    constructor(metroCore) {
        super(metroCore);
    }

    create(station, metroData) {
        const embed = new EmbedBuilder()
            .setTitle(`🔄 ${station.displayName} - Combinaciones`)
            .setColor(station.color || this._getLineColor(station.line));
        
        if (station.transferLines?.length > 0) {
            const transferInfo = station.transferLines.map(line => {
                const transferStation = this._findTransferStation(station, line, metroData);
                return transferStation 
                    ? `${this.metro.config.linesEmojis[line.toLowerCase()]} ${transferStation.displayName}`
                    : `Línea ${line.toUpperCase()} (no encontrada)`;
            }).join('\n');
            
            embed.setDescription(`**Estaciones de combinación:**\n${transferInfo}`);
        } else {
            embed.setDescription('Esta estación no tiene combinaciones con otras líneas.');
        }

        return embed;
    }

    _findTransferStation(currentStation, line, metroData) {
        const baseName = currentStation.displayName.replace(/\s(L\d+[a-z]?)$/i, '').trim();
        const transferDisplayName = `${baseName} ${line.toUpperCase()}`;
        return Object.values(metroData.stations)
            .find(s => s.displayName === transferDisplayName);
    }

    _getLineColor(line) {
        const colors = {
            'l1': 0xFF0000, 'l2': 0xFFA500, 'l3': 0xFFD700,
            'l4': 0x0000FF, 'l4a': 0x00CED1, 'l5': 0x008000, 'l6': 0x800080,
        };
        return colors[line.toLowerCase()] || 0x000000;
    }
}

module.exports = StationTransfersEmbed;