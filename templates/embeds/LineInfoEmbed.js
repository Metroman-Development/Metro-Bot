// templates/embeds/LineInfoEmbed.js
const BaseEmbed = require('./baseEmbed');
const StatusEmbed = require('./StatusEmbed');

class LineInfoEmbed extends StatusEmbed {
    create(lineKey, userId, interactionId) {
        const line = metro.lines.getLineInfo(lineKey);
        const status = this.statusCodes[line.status];
        
        return {
            embed: this.createEmbed({
                title: `${metro.config.linesEmojis[lineKey]} ${line.nombre}`,
                description: line.data.Características || 'No hay características adicionales',
                color: status.color,
                fields: this._buildLineFields(line),
                footer: { 
                    text: `Estado: ${status.name} | Actualizado: ${this._formatTime(line.lastUpdated)}`
                }
            }),
            buttons: this._createLineButtons(lineKey, userId, interactionId)
        };
    }

    _buildLineFields(line) {
        return [
            { name: '📅 Estreno', value: line.data.Estreno || 'N/A', inline: true },
            { name: '📏 Longitud', value: line.data.Longitud || 'N/A', inline: true },
            { name: '🚉 Estaciones', value: line.data['N° estaciones'] || 'N/A', inline: true },
            { name: '🏙️ Comunas', value: line.data.Comunas?.join(', ') || 'N/A', inline: false },
            { name: '🔌 Electrificación', value: line.data.Electrificación || 'N/A', inline: true },
            { name: '🚈 Flota', value: line.data.Flota?.join(', ') || 'N/A', inline: true }
        ];
    }

    _createLineButtons(lineKey, userId, interactionId) {
        return metro.lines.getAllLines().map(line => 
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`lineaInfo_${userId}_${interactionId}_${line.id}`)
                    .setLabel(`Línea ${line.id.replace('l', '')}`)
                    .setStyle(line.id === lineKey ? ButtonStyle.Primary : ButtonStyle.Secondary)
            )
        );
    }
}

module.exports = LineInfoEmbed;