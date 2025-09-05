const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class StationEmbed {
    static create(station) {
        const embed = new EmbedBuilder()
            .setTitle(`🚉 ${station.displayName} (${station.line.toUpperCase()})`)
            .setColor(station.color)
            .setImage(station.image)
            .addFields(
                { name: 'Estado', value: `${station.status.appMessage}`, inline: true },
                //{ name: 'Horario', value: station.schedule || 'Consultar /horario', inline: true },
                { name: 'Comuna', value: station.commune || 'No disponible', inline: true }, 
                
                { name: 'Servicios', value: station.services || "Sin Información"},
                
                
                
                
            );

        if (station.connections) {
            embed.addFields({
                name: 'Conexiones',
                value: this._formatConnections(station.connections),
                inline: false
            });
        }
        
        if (station.commerce ) {

            embed.addFields({

                name: 'Comercio',

                value: station.commerce,

                inline: false

            });

        }

        if (station.amenities ) {

            embed.addFields({

                name: 'Cultura',

                value: station.amenities,

                inline: false

            });

        }
        
        // Commented out buttons section - keeping the code for future use
        /*
        let components = null;
        if (station.hasMoreInfo) {
            components = this._createActionRow(station.id);
        }
        */

        // Return without components for now
        return { 
            embed,
            components: [] // Return empty array instead of null
        };
    }

    static _formatConnections(connections) {
        const connAr = [
            ...(connections.lines || []),
            ...(connections.other || []),
            ...(connections.bikes || [])
        ];

        if (connAr.length === 0) {
            return "Ninguna";
        }
        
        return connAr.join(', ');
    }

    // Keeping button creation method commented but available
    /*
    static _createActionRow(stationId) {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`station_more_${stationId}`)
                .setLabel('Más Información')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setLabel('Mapa Oficial')
                .setURL('https://www.metro.cl/estaciones')
                .setStyle(ButtonStyle.Link)
        );
    }
    */

    static _getLineColor(line) {
        const colors = {
            '1': 0xFF0000, // Red
            '2': 0xFFA500, // Orange
            '3': 0xFFD700, // Yellow
            '4': 0x0000FF, // Blue
            '4a': 0x00CED1, // Teal
            '5': 0x008000, // Green
            '6': 0x800080  // Purple
        };
        return colors[line] || 0x000000;
    }

    static _getLineImage(line) {
        return `https://www.metro.cl/images/lines/line-${line}.png`;
    }
}

module.exports = StationEmbed;