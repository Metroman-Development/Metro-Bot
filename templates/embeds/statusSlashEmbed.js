// templates/embeds/StatusEmbed.js
const BaseEmbed = require('./baseEmbed');

class StatusEmbed extends BaseEmbed {
    constructor(metroCore) {
        super(metroCore);
    }

    createNetworkStatus(networkStatus, lineStatuses) {
        const mainStatus = this.statusConfig[networkStatus.code];
        
        return {
            embed: this.createEmbed({
                title: `🚇 Estado de la Red: ${mainStatus.emoji} ${mainStatus.name}`,
                description: this._buildNetworkDescription(networkStatus),
                color: mainStatus.color,
                fields: this._buildLineFields(lineStatuses),
                footer: { 
                    text: `Actualizado: ${new Date(networkStatus.timestamp).toLocaleString('es-CL')}` 
                }
            }),
            components: [this._createRefreshRow()]
        };
    }

    createLineStatus(lineStatus) {
        const status = this.statusConfig[lineStatus.code];
        
        return {
            embed: this.createEmbed({
                title: `${status.emoji} Línea ${lineStatus.number}`,
                description: `**Estado:** ${status.name}\n**Detalles:** ${lineStatus.message}`,
                color: status.color,
                fields: this._buildStationFields(lineStatus.stations),
                footer: { 
                    text: `Última actualización: ${new Date(lineStatus.timestamp).toLocaleString('es-CL')}` 
                }
            }),
            components: [this._createBackRow()]
        };
    }

    createStationStatus(stationData) {
        const statusCode = stationData.status.code;
        const statusEmoji = this._getStatusEmoji(statusCode);
        const statusText = this._getStatusText(statusCode);
        
        return {
            embed: this.createEmbed({
                title: `🚉 Estación ${stationData.name}`,
                description: `**Línea:** ${stationData.line}\n` +
                            `**Estado:** ${statusEmoji} ${statusText}`,
                color: this._getStatusColor(statusCode),
                fields: [
                    {
                        name: 'Detalles',
                        value: stationData.status.message || 'Operación normal',
                        inline: false
                    },
                    ...this._buildConnectionFields(stationData.connections)
                ],
                footer: { 
                    text: `Última actualización: ${stationData.updated}` 
                }
            }),
            components: [this._createBackRow()]
        };
    }

    // Private Helpers
    _buildNetworkDescription(status) {
        let desc = `📅 **Horario:** ${status.schedule}\n`;
        desc += status.issues ? `⚠️ **Incidencias:** ${status.issues}` : '✅ Operación normal';
        return desc;
    }

    _buildLineFields(lines) {
        return lines.map(line => {
            const status = this.statusConfig[line.code];
            return {
                name: `${status.emoji} Línea ${line.number}`,
                value: `• **Estado:** ${status.name}\n` +
                       `• **Detalles:** ${line.message || 'Operación normal'}`,
                inline: true
            };
        });
    }

    _buildStationFields(stations) {
        return stations.map(station => ({
            name: `🚉 ${station.name}`,
            value: `• Estado: ${this._getStatusEmoji(station.code)} ${station.status}\n` +
                   `• Mensaje: ${station.message || 'Normal'}`,
            inline: false
        }));
    }

    _buildConnectionFields(connections) {
        if (!connections || connections.length === 0) return [];
        
        return connections.map(conn => ({
            name: `🔗 Conexión con Línea ${conn.id}`,
            value: `Estado: ${this._getStatusEmoji(conn.status)} ${this._getStatusText(conn.status)}`,
            inline: true
        }));
    }

    _getStatusEmoji(statusCode) {
        const emojiMap = {
            '1': '🟢',
            '2': '🟡',
            '3': '🔴',
            'default': '⚪'
        };
        return emojiMap[statusCode] || emojiMap.default;
    }

    _getStatusText(statusCode) {
        const statusMap = {
            '1': 'Operativa',
            '2': 'Parcial',
            '3': 'Cerrada',
            'default': 'Desconocido'
        };
        return statusMap[statusCode] || statusMap.default;
    }

    _getStatusColor(statusCode) {
        const colorMap = {
            '1': 0x00AA00, // Green
            '2': 0xFFAA00, // Yellow
            '3': 0xAA0000, // Red
            'default': 0xAAAAAA // Gray
        };
        return colorMap[statusCode] || colorMap.default;
    }

    _createRefreshRow() {
        return this.createActionRow([
            this.createButton(
                'status_refresh',
                '🔄 Actualizar',
                ButtonStyle.Secondary
            )
        ]);
    }

    _createBackRow() {
        return this.createActionRow([
            this.createButton(
                'status_back',
                '↩️ Volver',
                ButtonStyle.Primary
            )
        ]);
    }
}

module.exports = StatusEmbed;