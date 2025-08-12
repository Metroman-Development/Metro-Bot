const { EmbedBuilder } = require('discord.js');
const metroConfig = require('../../config/metro/metroConfig');
const styles = require('../../config/metro/styles.json');
const logger = require('../../events/logger');
const TimeHelpers = require('../../modules/chronos/timeHelpers');
const decorators = require('../../modules/metro/utils/stringHandlers/decorators');
const stationGrouper = require('../../templates/utils/stationGrouper');

class StatusEmbeds {
    #metroCore;

    // Severity mapping from StatusEmbedBuilder
    static #SEVERITY_MAP = new Map([
        ['critical',     { emoji: '💀', display: 'Crítica',    color: '#8b0000' }],
        ['very high',    { emoji: '🔥', display: 'Muy Alta',   color: '#ff4500' }],
        ['high',        { emoji: '⚠️', display: 'Alta',      color: '#ff8c00' }],
        ['moderate',    { emoji: '🔶', display: 'Moderada',  color: '#ffa500' }],
        ['low',         { emoji: '🔸', display: 'Baja',      color: '#ffd700' }],
        ['normal',      { emoji: '✅', display: 'Normal',    color: '#2e8b57' }],
        ['unknown',     { emoji: '❔', display: 'Desconocida', color: '#778899' }]
    ]);

    constructor(metroCore) {
        this.#metroCore = metroCore;
    }

    // Private helper methods from StatusEmbedBuilder, adapted for the class
    #getStatusMapping(code) {
        const codeStr = code.toString();
        return metroConfig.statusMapping[codeStr] || metroConfig.statusMapping['1'];
    }

    #getSeverityInfo(severity) {
        const severityLabel = severity?.severityLabelEn?.toLowerCase() || 'normal';
        return StatusEmbeds.#SEVERITY_MAP.get(severityLabel) || StatusEmbeds.#SEVERITY_MAP.get('normal');
    }

    #getNetworkStatus(data) {
        const statusCode = data.status?.code || (data.status === 'partial_outage' ? '3' : data.status === 'major_outage' ? '2' : '1');
        const statusInfo = metroConfig.NETWORK_STATUS_MAP[parseInt(statusCode)] || metroConfig.NETWORK_STATUS_MAP[1];
        return {
            emoji: statusInfo.emoji,
            display: statusInfo.message,
            color: this.#getColorForStatus(statusCode)
        };
    }

    #getColorForStatus(statusCode) {
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

    // Public embed creation methods

    buildOverviewEmbed(networkData = {}, changes = []) {
        try {
            const allData = this.#metroCore.api.getProcessedData();
            if (!allData) return this.buildErrorEmbed('Datos de red no válidos');

            const networkStatus = this.#getNetworkStatus(networkData);
            const severityInfo = this.#getSeverityInfo(networkData.summary?.es?.nivelSeveridad);

            const embed = new EmbedBuilder()
                .setTitle(`${metroConfig.linesEmojis.l1} ${metroConfig.linesEmojis.l2} ${metroConfig.linesEmojis.l3} ${metroConfig.linesEmojis.l4} ${metroConfig.linesEmojis.l4a} ${metroConfig.linesEmojis.l5} ${metroConfig.linesEmojis.l6} Estado General de la Red de Metro`)
                .setColor(severityInfo.color || networkStatus.color)
                .setDescription(`**Estado General:** ${networkStatus.emoji} ${networkStatus.display}\n**Gravedad:** ${severityInfo.emoji} ${severityInfo.display}`)
                .setThumbnail(metroConfig.metroLogo.principal);

            // Add line statuses
            const lineStatusList = Object.values(allData.lines)
                .map(line => {
                    const lineEmoji = metroConfig.linesEmojis[line.id] || '🚇';
                    const statusInfo = this.#getStatusMapping(line.status.code);
                    const expressIndicator = TimeHelpers.isExpressActive() && metroConfig.expressLines.includes(line.id.toLowerCase()) ? '🚄 ' : '';
                    return `${statusInfo.emoji} ${expressIndicator}${lineEmoji} **${line.displayName}**: ${line.status.appMessage || statusInfo.message}`;
                })
                .join('\n');

            embed.addFields({ name: '🚇 Estado de Líneas', value: lineStatusList || 'No disponible' });

            embed.setFooter({
                text: `Actualizado: ${TimeHelpers.formatTime(networkData.lastUpdated)} | Gravedad: ${severityInfo.display}`,
                iconURL: 'https://cdn.discordapp.com/emojis/1349494723760492594.webp'
            });

            return embed;
        } catch (error) {
            logger.error('OVERVIEW_EMBED_FAILED', { error: error.message, stack: error.stack, input: networkData });
            return this.buildErrorEmbed('Error al generar el estado general');
        }
    }

    buildLineEmbed(lineData = {}) {
        try {
            const allStations = this.#metroCore.api.getProcessedData().stations;
            const lineKey = lineData.id?.toLowerCase() || 'unknown';
            const statusInfo = this.#getStatusMapping(lineData.status.code);
            const color = typeof lineData.color === 'string' && lineData.color.startsWith('#')
                ? parseInt(lineData.color.slice(1), 16)
                : lineData.color || styles.lineColors[lineKey] || '#5865F2';

            const embed = new EmbedBuilder()
                .setTitle(`${metroConfig.linesEmojis[lineKey] || '🚇'} ${lineData.displayName}`)
                .setColor(color)
                .setDescription(`**Estado:** ${statusInfo.emoji} ${statusInfo.message}\n**Detalles:** ${lineData.status.appMessage || 'Sin detalles.'}`);

            // Use stationGrouper for a better station list
            const problematicGroups = stationGrouper.groupStationsByStatus(lineData.stations, allStations, station => ["2", "3", "4"].includes(station.status?.code));
            const normalGroups = stationGrouper.groupStationsByStatus(lineData.stations, allStations, station => station.status?.code === "1");

            if (problematicGroups.length > 0) {
                let problemSection = '';
                problematicGroups.forEach(group => {
                    const groupStatusInfo = this.#getStatusMapping(group.statusCode);
                    problemSection += `\n${groupStatusInfo.emoji} **${group.firstStation.displayName} → ${group.lastStation.displayName}**: ${groupStatusInfo.message}`;
                });
                embed.addFields({ name: '🚧 Tramos con Problemas', value: problemSection });
            }

            if (normalGroups.length > 0) {
                let normalSection = '';
                 normalGroups.forEach(group => {
                    normalSection += `\n🟢 **${group.firstStation.displayName}** → **${group.lastStation.displayName}**`;
                });
                embed.addFields({ name: '✅ Tramos Operativos', value: normalSection });
            }

            embed.setFooter({ text: `Actualizado: ${TimeHelpers.formatTime(lineData.lastUpdated || new Date())}` });

            return embed;
        } catch (error) {
            logger.error('LINE_EMBED_FAILED', { line: lineData?.id, error: error.message, stack: error.stack });
            return this.buildErrorEmbed(`Error al mostrar línea ${lineData?.displayName || 'desconocida'}`);
        }
    }

    buildStationEmbed(station) {
        try {
            const statusStyle = this.#getStatusMapping(station.status.code);
            const color = this.#getColorForStatus(station.status.code);

            const embed = new EmbedBuilder()
                .setTitle(`${metroConfig.linesEmojis[station.line]} Estación ${station.name || 'Desconocida'}`)
                .setColor(color)
                .setDescription(`**Estado:** ${statusStyle.emoji} ${statusStyle.message}`);

            let info = station.status.appMessage || 'No hay información adicional.';
            if (station.transferLines && station.transferLines.length > 0) {
                // Simplified transfer logic
                info += `\n**Combinación:** Con Línea(s) ${station.transferLines.join(', ')}`;
            }
            embed.addFields({ name: '📌 Información', value: info });

            embed.setFooter({ text: `Última actualización: ${TimeHelpers.formatTime(station.lastUpdated || new Date())}` });

            return embed;
        } catch (error) {
            logger.error('STATION_EMBED_FAILED', { station: station?.id, error: error.message, stack: error.stack });
            return this.buildErrorEmbed(`Error al mostrar estación ${station?.name || 'desconocida'}`);
        }
    }

    buildErrorEmbed(message = 'Error desconocido') {
        return new EmbedBuilder()
            .setTitle('⚠️ Error del Sistema')
            .setDescription(message)
            .setColor('#ff0000')
            .setTimestamp();
    }
}

module.exports = StatusEmbeds;
