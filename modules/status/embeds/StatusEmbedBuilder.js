// modules/embeds/StatusEmbedBuilder.js
// modules/embeds/StatusEmbedBuilder.js
const { EmbedBuilder } = require('discord.js');
const metroConfig = require('../../../config/metro/metroConfig');
const styles = require('../../../config/metro/styles');
const logger = require('../../../events/logger');
const TimeHelpers = require('../../chronos/timeHelpers');
const decorators = require('../../metro/utils/stringHandlers/decorators');

class StatusEmbedBuilder {
    static #SEVERITY_MAP = new Map([
        ['critical',     { emoji: '💀', display: 'Crítica',    color: '#8b0000' }],
        ['very high',    { emoji: '🔥', display: 'Muy Alta',   color: '#ff4500' }],
        ['high',        { emoji: '⚠️', display: 'Alta',      color: '#ff8c00' }],
        ['moderate',    { emoji: '🔶', display: 'Moderada',  color: '#ffa500' }],
        ['low',         { emoji: '🔸', display: 'Baja',      color: '#ffd700' }],
        ['normal',      { emoji: '✅', display: 'Normal',    color: '#2e8b57' }],
        ['unknown',     { emoji: '❔', display: 'Desconocida', color: '#778899' }]
    ]);

    // Helper methods for consistent status code handling
    static #getStatusMapping(code) {
        const codeStr = code.toString();
        return metroConfig.statusMapping[codeStr] || metroConfig.statusMapping['1'];
    }

    static #getStationIcon(code) {
        const codeNum = parseInt(code);
        return metroConfig.stationIcons[codeNum] || metroConfig.stationIcons[1];
    }

    static #getCombIcon(code) {
        const codeNum = parseInt(code);
        return metroConfig.combIcons[codeNum] || metroConfig.combIcons[1];
    }

    static buildOverviewEmbed(networkData = {}, changes = [], metroCore = {}, UI_STRINGS = {}) {
        try {
            const validatedData = this.#validateNetworkData(networkData, metroCore);
            if (!validatedData) return this.buildErrorEmbed('Datos de red no válidos');

            const networkStatus = this.#getNetworkStatus(networkData);
            const severityInfo = this.#getSeverityInfo(networkData);

            const embed = new EmbedBuilder()
                .setTitle(`${metroConfig.linesEmojis.l1} ${metroConfig.linesEmojis.l2} ${metroConfig.linesEmojis.l3} ${metroConfig.linesEmojis.l4} ${metroConfig.linesEmojis.l4a} ${metroConfig.linesEmojis.l5} ${metroConfig.linesEmojis.l6} Estado General de la Red de Metro`)
                .setColor(severityInfo.color || networkStatus.color)
                .setDescription(this.#buildNetworkDescription(networkData, validatedData, severityInfo))
                .setThumbnail(metroConfig.metroLogo.principal);

            this.#addLineStatusList(embed, validatedData, metroCore);
            this.#addCriticalLinesField(embed, validatedData, metroCore);
            this.#addTransferStatusField(embed, validatedData, metroCore);

            if (changes?.changes?.length > 0) {
                this.#addChangesField(embed, changes, metroCore);
            }

            embed.addFields({
                name: '📝 Leyenda Completa',
                value: this.#generateEnhancedStatusLegend() || "Sin Info",
                inline: false
            });

            embed.setFooter({
                text: `Actualizado: ${TimeHelpers.formatTime(validatedData.lastUpdated)} | Gravedad: ${severityInfo.display}`,
                iconURL: 'https://cdn.discordapp.com/emojis/1349494723760492594.webp'
            });

            return embed;
        } catch (error) {
            logger.error('OVERVIEW_EMBED_FAILED', {
                error: error.message,
                stack: error.stack,
                input: networkData
            });
            return this.buildErrorEmbed('Error al generar el estado general');
        }
    }

    static #addLineStatusList(embed, data, metroCore) {
        const lineStatusList = Object.values(data.lines || {})
            .map(line => {
                const lineEmoji = metroConfig.linesEmojis[line.id] || '🚇';
                const statusInfo = this.#getLineStatus(line);
                
                const hasProblemStations = Object.values(data.stations || {}).some(
                    station => station.line === line.id && 
                             parseInt(station.status?.code) !== 1); // Only non-operational stations
                
                const warningEmoji = hasProblemStations ? '⚠️ ' : '';
                
                let statusLine = line.status?.message?.replace(/\b(L[1-6](?:[a-d])?)\b/gi, match => {
                    const lineKey = match.toLowerCase();
                    return metroConfig.linesEmojis[lineKey] || match;
                }) || line.status?.appMessage || '';
       
         const expressIndicator =  TimeHelpers.isExpressActive() && metroConfig.expressLines.includes(line.id.toLowerCase()) ? '🚄 ' : '';

      
                
                return `${statusInfo.emoji} ${warningEmoji}${expressIndicator}${lineEmoji} **${line.displayName}** ***${statusLine}***`;
            })
            .join('\n');

        embed.addFields({
            name: '🚇 Estado de Líneas',
            value: lineStatusList || 'No hay información de líneas disponible',
            inline: false
        });
    }

    static #validateNetworkData(data, metroCore) {
        const allData = metroCore.api?.getProcessedData();
        if (!allData) return null;
        
        const network = data.network || data;
        
        return {
            status: {
                code: network.statusCode || network.status?.code || '1',
                message: network.message || network.status || '',
                severity: network.severity || network.status?.severityLabel?.toLowerCase() || 'none',
                appMessage: network.summary?.es?.estadoGeneral || network.status?.appMessage || '',
                severityLabel: network.summary?.es?.nivelSeveridad || 'Normal',
                severityLabelEn: network.summary?.es?.severityLevel || 'Normal'
            },
            operationalPercentage: network.operationalPercentage || 100,
            affectedLines: Object.values(network.details?.lines || {}),
            affectedStations: (network.details?.stations || []).slice(0, 10),
            criticalTransfers: (network.details?.transfers || [])
                .filter(t => t && (parseInt(t.status) !== 1 || t.totalSeverity > 0)),
            criticalLines: (network.details?.lines ? 
                Object.values(network.details.lines)
                    .sort((a,b) => b.severity - a.severity)
                    .slice(0, 3) : 
                []),
            lines: allData.lines || {},
            stations: allData.stations || {},
            lastUpdated: data.lastUpdated || new Date().toISOString(),
            details: network.details || {}
        };
    }

    static #buildNetworkDescription(data, validData, severityInfo) {
        const networkStatusInfo = this.#getNetworkStatus(data);
        const parts = [
            `${networkStatusInfo.emoji} **Estado General:** \`${data.status}\``,
            `📊 **Gravedad:** ${severityInfo.emoji} ${data.summary?.es?.nivelSeveridad || 'Normal'}`,
            `🔄 **Actualizado:** ${TimeHelpers.formatTime(data.lastUpdated)}`
        ];
        return parts.filter(Boolean).join('\n');
    }

    static #addCriticalLinesField(embed, data, metroCore) {
        if (data.details.lines && data.details.lines.length > 0) {
            const criticalLinesText = data.details.lines.map(line => {
                const lineKey = line.name.toLowerCase().replace('línea ', 'l');
                const lineEmoji = metroConfig.linesEmojis[lineKey] || '🚇';
                const lineStatus = this.#getLineStatus(line);
                return [
                    `${lineEmoji} **${line.name}:** ${lineStatus.emoji} ${line.status}`,
                    `• Impacto: ${line.severity} | ${this.#getSeverityInfo(line.severity/10).display}`,
                    line.statusDetails ? `• Detalles: ${line.statusDetails}` : ''
                ].filter(Boolean).join('\n');
            }).join('\n\n');

            embed.addFields({
                name: '🚧 Líneas con Mayor Impacto',
                value: criticalLinesText || 'Todas las líneas operativas',
                inline: false
            });
        }
    }

    static #addTransferStatusField(embed, data, metroCore) {
        const problematicTransfers = (data.criticalTransfers || []).filter(transfer => {
            if (!transfer || !transfer.lines || transfer.lines.length < 2) return false;
            const status = parseInt(transfer.status);
            return !isNaN(status) && status !== 1;
        });

        if (problematicTransfers.length > 0) {
            const transferText = problematicTransfers.map(transfer => {
                const lines = transfer.lines
                    .filter(l => l)
                    .map(l => metroConfig.linesEmojis[l] || l)
                    .join(' ↔ ');
                
                if (!lines) return null;

                const transferStatus = this.#getCombIcon(transfer.status);
                const severityInfo = this.#getSeverityInfo(transfer);
                
                return [
                    `🔄 **${transfer.station?.toUpperCase() || 'Transferencia'}:** ${lines}`,
                    `${transferStatus.emoji} **Estado:** ${transferStatus.message}`,
                    `• Impacto: ${severityInfo.emoji} ${severityInfo.display}`
                ].join('\n');
            }).filter(Boolean).join('\n\n');

            if (transferText) {
                embed.addFields({
                    name: '🔀 Transferencias Afectadas',
                    value: transferText,
                    inline: false
                });
            }
        }
    }

    static #addChangesField(embed, changes, metroCore) {
        const changeList = changes.changes.slice(0, 5).map(change => {
            const time = TimeHelpers.formatTime(change.timestamp);
            switch (change.type) {
                case 'station':
                    return `${time}: ${decorators.decorateStation({
                        id: change.id,
                        name: change.name,
                        line: change.line,
                        status: { code: change.to }
                    }, metroCore, { showName: true, showStatus: true, showLine: true })}`;
                case 'line':
                    return `${time}: ${decorators.decorateLine(change.id, metroCore)} → ${this.#getStatusMapping(change.to).emoji}`;
                case 'network':
                    return `${time}: Red → ${metroConfig.NETWORK_STATUS_MAP[parseInt(change.to)]?.emoji || '❓'}`;
                default:
                    return `${time}: ${change.id} → ${this.#getStatusEmoji(change.to)}`;
            }
        }).join('\n');

        embed.addFields({
            name: '🔄 Cambios Recientes',
            value: changeList || 'No hay cambios recientes',
            inline: false
        });
    }

    static #generateEnhancedStatusLegend() {
        return "**🚇 Leyenda General**\n-# Esto se ha movido al comando `/bot iconografia`";
    }

    static buildLineEmbed(lineData = {}, allStations = {}, metroCore = {}) {
        try {
            const lineKey = lineData.id?.toLowerCase() || 'unknown';
            const lineStatus = this.#getLineStatus(lineData);
            const embed = new EmbedBuilder()
                .setTitle(`${metroConfig.linesEmojis[lineKey]} ${lineData.displayName}`)
                .setColor(lineData.color || styles.lineColors[lineKey] || '#5865F2')
                .setDescription(this.#formatLineStatus(lineData));

            if (Array.isArray(lineData.stations)) {
                const MAX_FIELD_SIZE = 1020;
                let currentChunk = [];
                let currentLength = 0;
                let fieldNumber = 1;

                const processChunk = () => {
                    if (currentChunk.length > 0) {
                        embed.addFields({
                            name: fieldNumber === 1 ? '🚉 Estaciones' : `🚉 Estaciones (Parte ${fieldNumber})`,
                            value: currentChunk.join('\n'),
                            inline: false
                        });
                        fieldNumber++;
                        currentChunk = [];
                        currentLength = 0;
                    }
                };

                for (const stationId of lineData.stations) {
                    const station = allStations[stationId] || { id: stationId, name: stationId };
                    const decoratedStation = decorators.decorateStation(station, metroCore, {
                        showStatus: true,
                        showLine: false,
                        showTransfer: true,
                        showConnections: true,
                        maxLength: 60
                    });

                    if (currentLength + decoratedStation.length > MAX_FIELD_SIZE) {
                        processChunk();
                    }

                    currentChunk.push(decoratedStation);
                    currentLength += decoratedStation.length + 1;
                }

                processChunk();
            }

            embed.setFooter({
                text: `Actualizado: ${TimeHelpers.formatTime(lineData.lastUpdated || new Date())}` +
                      (metroConfig.liveMapUrl ? ` | [Ver Mapa](${metroConfig.liveMapUrl})` : '')
            });

            return embed;
        } catch (error) {
            logger.error('LINE_EMBED_FAILED', {
                line: lineData?.id,
                error: error.message,
                stack: error.stack
            });
            return this.buildErrorEmbed(`Error al mostrar línea ${lineData?.displayName || 'desconocida'}`);
        }
    }

    static #formatLineStatus(lineData) {
        const statusInfo = this.#getLineStatus(lineData);
        const statusCode = parseInt(lineData.status?.code || lineData.statusCode || '1');
        
        let statusMessage = lineData.status?.message;
        if (!statusMessage && lineData.status?.appMessage) {
            statusMessage = lineData.status.appMessage;
        }
        
        if (statusCode === 5) {
            statusMessage = statusMessage || "Servicio extendido en ciertas estaciones";
        }
        

        const parts = [
            `**📡 Estado:** ${statusInfo.emoji} ${statusInfo.message}`,
            statusMessage ? `**📝 Detalles:** ${statusMessage}` : '',
            lineData.status?.appMessage && statusMessage !== lineData.status.appMessage 
                ? `**📢 Info App:** \`${lineData.status.appMessage}\`` 
                : '', 
            
            TimeHelpers.isExpressActive() && metroConfig.expressLines.includes(lineData.id.toLowerCase()) ? '🚄 Rutas Expresas Operativas' : ''
        ];

        return parts.filter(Boolean).join('\n');
    }

    static #getSeverityInfo(severity) {
        const severityLabel = severity?.severityLabelEn?.toLowerCase() || 'normal';
        return this.#SEVERITY_MAP.get(severityLabel) || this.#SEVERITY_MAP.get('normal');
    }

    static #getNetworkStatus(data) {
        const statusCode = data.status?.code || 
                         (data.status === 'partial_outage' ? '3' : 
                          data.status === 'major_outage' ? '2' : '1');
        const statusInfo = metroConfig.NETWORK_STATUS_MAP[parseInt(statusCode)] || metroConfig.NETWORK_STATUS_MAP[1];
        return {
            emoji: statusInfo.emoji,
            display: statusInfo.message,
            color: this.#getColorForStatus(statusCode)
        };
    }

    static #getLineStatus(data) {
        const statusCode = data.status?.code || data.statusCode || '1';
        return this.#getStatusMapping(statusCode);
    }

    static #getStationStatus(data) {
        const statusCode = data.status?.code || 
                         (data.statusTerm === 'Cerrada' ? '2' : '1');
        return this.#getStationIcon(statusCode);
    }

    static #getColorForStatus(statusCode) {
        const code = parseInt(statusCode.toString());
        switch(code) {
            case 0: return '#95a5a6';
            case 1: return '#2ecc71';
            case 2: return '#e74c3c';
            case 3: return '#f39c12';
            case 4: return '#e67e22';
            case 5: return '#4CAF50';
            default: return '#95a5a6';
        }
    }

    static #getStatusEmoji(status) {
        return decorators.getStatusEmoji(status);
    }

    static buildErrorEmbed(message = 'Error desconocido') {
        return new EmbedBuilder()
            .setTitle('⚠️ Error del Sistema')
            .setDescription(message)
            .setColor('#ff0000')
            .setTimestamp();
    }
}

module.exports = StatusEmbedBuilder;// modules/embeds/StatusEmbedBuilder.js
