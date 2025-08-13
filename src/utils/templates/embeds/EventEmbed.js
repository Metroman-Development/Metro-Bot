// templates/embeds/EventEmbed.js
const BaseEmbed = require('./baseEmbed');

class EventEmbed extends BaseEmbed {
    create(event) {
        return this.createEmbed({
            title: `📅 ${event.name}`,
            description: this._buildEventDescription(event),
            color: 0x9b59b6, // Purple for events
            fields: this._buildEventFields(event),
            footer: {
                text: `Desde ${this._formatTime(event.startTime)} hasta ${this._formatTime(event.endTime)}`
            }
        });
    }

    _buildEventDescription(event) {
        return [
            `**Tipo:** ${event.type}`,
            `**Líneas afectadas:** ${event.affectedLines.join(', ')}`,
            `**Estaciones afectadas:** ${event.affectedStations.join(', ') || 'Ninguna específica'}`,
            `\n${event.description}`
        ].join('\n');
    }
}

module.exports = EventEmbed;
