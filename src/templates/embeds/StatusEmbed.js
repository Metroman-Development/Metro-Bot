// templates/embeds/StatusEmbed.js
const BaseEmbed = require('./baseEmbed');
const config = require('../../config/metro/metroConfig') 
// templates/embeds/StatusEmbed.js

const stationGrouper = require('../utils/stationGrouper');

// templates/embeds/StatusEmbed.js


class StatusEmbed extends BaseEmbed {
    constructor(metroCore) {
        super(metroCore);
    }

 
    

    static _buildConnectionFields(connections) {
        if (!connections || connections.length === 0) return [];
        
        return connections.map(conn => {
            const statusInfo = config.statusTypes[conn.status] || config.statusTypes.default;
            return {
                name: `🔗 Conexión con Línea ${conn.id}`,
                value: `Estado: ${statusInfo.emoji} ${statusInfo.description}`,
                inline: true
            };
        });
    }

    static createStationStatus(metro, station) {
        const statusCode = station.status?.code || 'default';
        const statusInfo = config.statusTypes[statusCode] || config.statusTypes.default;

        let transferInfo = "";
        if (station.transferLines.length > 0) {
            const cleanStationName = station.name.replace(/\s*L\d+[A-Z]?\s*/i, '');
            const stations = Object.values(metro.api.getProcessedData().stations);
            const transferStation = stations.find(s => s.displayName === `${cleanStationName} ${station.line.toUpperCase()}`);

            if (transferStation) {
                const transferStatus = config.statusTypes[transferStation.status?.code] || config.statusTypes.default;
                const isTransferAvailable = statusInfo.isOperational && transferStatus.isOperational;
                transferInfo = isTransferAvailable ? "\n✅ Combinación Disponible" : "\n❌ Combinación No Disponible, prefiera alternativas";
            }
        }

        const stationInfo = (station.status?.appMessage || 'Estado No Disponible') + "\n" + "📢 Info Extra: " + (station.status.message !== "" ? station.status.message : "Sin información adicional.") + transferInfo;

        return {
            embed: {
                title: `${config.linesEmojis[station.line]} Estación ${station.name || 'Desconocida'}`,
                description: `**### 👀 Estado:** ${statusInfo.emoji} ${statusInfo.description}`,
                color: statusInfo.color,
                fields: [
                    {
                        name: '📌Información',
                        value: stationInfo,
                        inline: false
                    },
                    ...this._buildConnectionFields(station.connections),
                ],
                footer: {
                    text: `Última actualización: ${station.lastUpdated || 'Desconocida'}`
                }
            }
        };
    }

    createNetworkStatus(networkStatus, lineStatuses) {
        const mainStatus = config.statusTypes[networkStatus.code] || config.statusTypes.default;

        return {
            embed: this.createEmbed({
                title: `🚇 Estado de la Red: ${mainStatus.emoji} ${mainStatus.description}`,
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

    static createLineStatus(metro, line) {
        const metroData = metro.api.getProcessedData();
        const allStations = metroData.stations;

        const lineColor = typeof line.color === 'string' && line.color.startsWith('#')
            ? parseInt(line.color.slice(1), 16)
            : line.color || 0x7289DA;

        const problematicGroups = stationGrouper.groupStationsByStatus(
            line.stations,
            allStations,
            station => !(config.statusTypes[station.status?.code] || config.statusTypes.default).isOperational
        );

        const normalGroups = stationGrouper.groupStationsByStatus(
            line.stations,
            allStations,
            station => (config.statusTypes[station.status?.code] || config.statusTypes.default).isOperational
        );

        const sections = [];
        const lineStatusInfo = config.statusTypes[line.status?.code] || config.statusTypes.default;
        sections.push(`**📢 Estado general:** ${lineStatusInfo.emoji} \`${lineStatusInfo.description}\``);
        if (line.status.message) {
            sections.push(`**Detalles:** ${line.status.message}`);
        }

        if (problematicGroups.length > 0) {
            let problemSection = '### 🚧 Estaciones con problemas\n';
            problematicGroups.forEach(group => {
                const statusInfo = config.statusTypes[group.statusCode] || config.statusTypes.default;
                problemSection += `\n${statusInfo.emoji} **${group.count} estación${group.count > 1 ? 'es' : ''}:** `;
                problemSection += `${group.firstStation.displayName} → ${group.lastStation.displayName}`;
                problemSection += `\n↳ ${statusInfo.description}\n`;
            });
            sections.push(problemSection);
        }

        if (normalGroups.length > 0) {
            let normalSection = problematicGroups.length === 0 ? '### 🎉✨ Toda la Línea Operativa\n' : '## ✅ Estaciones operativas\n';
            normalGroups.forEach(group => {
                const statusInfo = config.statusTypes[group.statusCode] || config.statusTypes.default;
                normalSection += `\n${statusInfo.emoji} **${group.count} estacion${group.count > 1 ? 'es' : ''}:** `;
                normalSection += `**${group.firstStation.displayName}** → **${group.lastStation.displayName}**`;
            });
            sections.push(normalSection);
        }

        const transferStations = line.stations
            .map(id => allStations[id])
            .filter(station => station?.transferLines?.length > 0);

        if (transferStations.length > 0) {
            let transferSection = '## 🔄 Estaciones de combinación\n';
            transferStations.forEach(station => {
                const baseName = station.displayName.replace(/\s(l\d+[a-z]?)$/i, '').trim();
                const stationStatusInfo = config.statusTypes[station.status.code] || config.statusTypes.default;
                transferSection += `\n ### ${stationStatusInfo.emoji}**__${baseName}__** *${stationStatusInfo.description}*`;

                station.transferLines.forEach((transferLineId) => {
                    const lineSuffix = transferLineId.toUpperCase();
                    const transferDisplayName = `${baseName} ${lineSuffix}`;
                    const sideStation = Object.values(allStations).find(s => s.displayName === transferDisplayName);

                    if (sideStation) {
                        const statusInfo = config.statusTypes[sideStation.status?.code] || config.statusTypes.default;
                        transferSection += `\n-# ↳ ${statusInfo.emoji}`;
                        transferSection += ` Combinación Línea ${config.linesEmojis[transferLineId] || '🚇'}`;
                        transferSection += ` *${statusInfo.description}*`;
                    }
                });
            });
            sections.push(transferSection);
        }

        return {
            embed: {
                title: `${config.linesEmojis[line.id] || '🚇'} ${line.displayName}`,
                description: sections.join('\n\n'),
                color: lineColor,
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'Actualizado',
                    icon_url: config.metroLogo.principal
                }
            }
        };
    }
          //  components: [this._createBackRow()]
       
   

    // Private Helpers
    _buildNetworkDescription(status) {
        let desc = `📅 **Horario:** ${status.schedule}\n`;
        desc += status.issues ? `⚠️ **Incidencias:** ${status.issues}` : '✅ Operación normal';
        return desc;
    }

    _buildLineFields(lines) {
        return lines.map(line => {
            const status = config.statusTypes[line.code] || config.statusTypes.default;
            return {
                name: `${status.emoji} Línea ${line.number}`,
                value: `• **Estado:** ${status.description}\n` +
                       `• **Detalles:** ${line.message || 'Sin detalles.'}`,
                inline: true
            };
        });
    }

    _buildStationFields(stations) {
        return stations.map(station => {
            const statusInfo = config.statusTypes[station.code] || config.statusTypes.default;
            return {
                name: `🚉 ${station.name}`,
                value: `• Estado: ${statusInfo.emoji} ${statusInfo.description}\n` +
                       `• Mensaje: ` + (station.message || 'Normal'),
                inline: false
            };
        });
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