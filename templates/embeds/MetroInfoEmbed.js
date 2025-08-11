// templates/embeds/MetroInfoEmbed.js
const BaseEmbed = require('./baseEmbed');

class MetroInfoEmbed extends BaseEmbed {
    create() {
        const networkStatus = this.metro.core.getNetworkStatus();
        const technicalData = this.metro.queries.getTechnicalData();
        
        return this.createEmbed({
            title: '🚇 Información General del Metro',
            description: this._buildDescription(networkStatus),
            color: this._getStatusColor(networkStatus.current),
            fields: [
                {
                    name: '📏 Características Técnicas',
                    value: this._buildTechnicalFields(technicalData),
                    inline: false
                },
                {
                    name: '🚉 Operación',
                    value: this._buildOperationFields(networkStatus),
                    inline: false
                }
            ],
            thumbnail: metro.config.logo,
            footer: { 
                text: 'Actualizado: ' + this._formatTime(networkStatus.lastUpdated) 
            }
        });
    }

    _buildDescription(status) {
        const statusInfo = this.statusCodes[status.current];
        return [
            `**Estado Actual:** ${statusInfo.emoji} ${statusInfo.name}`,
            `[🔗 Mapa de la Red](${metro.config.networkMapUrl})`
        ].join('\n');
    }

    _buildTechnicalFields(data) {
        return [
            `- 📏 Longitud: ${data.length}`,
            `- 🚉 Estaciones: ${data.stations}`,
            `- 🛤️ Ancho de vía: ${data.trackGauge}`,
            `- ⚡ Electrificación: ${data.electrification}`
        ].join('\n');
    }

    _buildOperationFields(status) {
        return [
            `- 🔢 Líneas: ${status.activeLines.length}/${status.totalLines}`,
            `- 🚇 Vagones: ${metro.queries.getActiveFleetCount()}`,
            `- 👥 Pasajeros: ${status.dailyPassengers.toLocaleString()}`,
            `- 👷 Operador: ${metro.config.operator}`
        ].join('\n');
    }
}

module.exports = MetroInfoEmbed;