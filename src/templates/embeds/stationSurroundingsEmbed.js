// templates/embeds/stationSurroundingsEmbed.js
const { EmbedBuilder } = require('discord.js');
const BaseEmbed = require('./baseEmbed');

class StationSurroundingsEmbed extends BaseEmbed {
    constructor(metroCore) {
        super(metroCore);
    }

    create(station) {
        const normalizedStationName = this._normalizeStationName(station.displayName);
        const embed = new EmbedBuilder()
            .setTitle(`📍 ${station.displayName} - Alrededores`)
            .setColor(station.color || this._getLineColor(station.line))
            .setImage(`https://www.metro.cl/el-viaje/estaciones/estaciones/${normalizedStationName}/plano.jpg`);
        
        embed.addFields({ 
            name: '📍 Comuna', 
            value: `👉 ${station.commune.replace("nunoa", "Ñuñoa")}` || 'No disponible', 
            inline: true 
        });
        
        if (station.connections?.transports?.length > 0) {
            embed.addFields({
                name: '🚌 Transportes',
                value: station.connections.transports.join('*\n👉 *'),
                inline: true
            });
        }

        if (station.connections?.bikes?.length > 0) {
            embed.addFields({
                name: '🚲 Cicleteros',
                value: `👉 *${station.connections.bikes.join('*\n👉 *')}*`,
                inline: true
            });
        }

        return embed;
    }

    _normalizeStationName(name) {
        let normalized = name.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s*l\d+[a-z]?/i, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]/g, '')
            .replace("puente-cal-y-canto", "cal-y-canto");
        
        if (normalized === "plaza-armas") normalized = "plaza-de-armas";
        if (normalized === "ula") normalized = "union-latinoamericana";
        
        return normalized;
    }

    _getLineColor(line) {
        const colors = {
            'l1': 0xFF0000, 'l2': 0xFFA500, 'l3': 0xFFD700,
            'l4': 0x0000FF, 'l4a': 0x00CED1, 'l5': 0x008000, 'l6': 0x800080,
        };
        return colors[line.toLowerCase()] || 0x000000;
    }
}

module.exports = StationSurroundingsEmbed;