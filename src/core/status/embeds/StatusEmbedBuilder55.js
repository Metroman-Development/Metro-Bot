// modules/embeds/StatusEmbedBuilder.js
// modules/embeds/StatusEmbedBuilder.js
const { EmbedBuilder } = require('discord.js');
const config = require('../config/statusConfig');
const metroConfig = require('../../../config/metro/metroConfig');
const { decorateStation } = require('../../metro/utils/stringHandlers/decorators');
const TimeHelpers = require('../../chronos/timeHelpers');
const logger = require('../../../events/logger');

class StatusEmbedBuilder {
    static buildOverviewEmbed(networkStatus, changes = [], metroCore = {}) {
        try {
            const embed = new EmbedBuilder()
                .setTitle(`${metroConfig.logoMetroEmoji} Estado de la Red - ${TimeHelpers.formatForEmbed()} CLT`)
                .setColor(this._getStatusColor(networkStatus.code))
                .setThumbnail(metroConfig.metroLogo.principal)
                .setTimestamp();

            // Get comprehensive service status
            const serviceStatus = TimeHelpers.getServiceStatus();
            const eventDetails = TimeHelpers.getEventDetails();

            // Build description with all time-related information
            const descriptionParts = [
                `**Estado Actual:** ${networkStatus.emoji} ${networkStatus.name}`,
                networkStatus.reason ? `*${networkStatus.reason}*` : '',
                `**Horario:** ${serviceStatus.operatingHours.opening} - ${serviceStatus.operatingHours.closing}`,
                serviceStatus.operatingHours.isExtended ? 
                    `📅 Horario extendido por: ${serviceStatus.operatingHours.eventName}` : '',
                `**Periodo Actual:** ${serviceStatus.period.name}`,
                serviceStatus.expressActive ? '🚄 **Servicio Express activo**' : ''
            ];

            // Add event information if available
            if (eventDetails) {
                descriptionParts.push(
                    `\n📅 **Evento:** ${eventDetails.name}`,
                    eventDetails.notes ? `*${eventDetails.notes}*` : '',
                    `🕒 Finaliza: ${eventDetails.endTime}`
                );

                if (eventDetails.affectedLines.length > 0) {
                    descriptionParts.push(
                        `🚧 **Líneas afectadas:** ${eventDetails.affectedLines.join(', ')}`
                    );
                }
            }

            embed.setDescription(descriptionParts.filter(Boolean).join('\n'));

            // Add special events from changes if any
            if (changes.events?.length > 0) {
                embed.addFields({
                    name: '📅 Eventos Especiales',
                    value: changes.events.map(e => 
                        `• ${e.event.name}: ${e.event.notes || 'Horario extendido'}`
                    ).join('\n')
                });
            }

            // Add line status overview if available
            if (networkStatus.lines) {
                embed.addFields({
                    name: '🚈 Estado por Línea',
                    value: Object.entries(networkStatus.lines).map(([lineId, line]) => 
                        `${this._getLineEmoji(lineId)} ${lineId.toUpperCase()} • ${line.emoji} ${line.status}`
                    ).join('\n'),
                    inline: false
                });
            }

            // Add closed stations if any
         /*   const closedStations = TimeHelpers.getClosedStations();
            if (closedStations.length > 0) {
                embed.addFields({
                    name: '🚧 Estaciones Cerradas',
                    value: closedStations.map(station => 
                        decorateStation({ id: station }, metroCore)
                    ).join('\n'),
                    inline: false*
                });
            }*/

            // Add recent changes if any
            if (changes.statusChanges?.length > 0) {
                embed.addFields({
                    name: '🔄 Cambios Recientes',
                    value: changes.statusChanges.slice(0, 3).map(change => 
                        `${TimeHelpers.formatForEmbed()}: ${change.description}`
                    ).join('\n'),
                    inline: false
                });
            }

            // Add next transition
            const nextTransition = TimeHelpers.getNextTransition();
            embed.addFields({
                name: '⏭️ Próximo Cambio',
                value: `${nextTransition.time}: ${nextTransition.message}`,
                inline: true
            });

            // Add legend
            embed.addFields({
                name: '📝 Leyenda',
                value: [
                    `${metroConfig.statusMapping['1'].emoji} = Operativa`,
                    `${metroConfig.statusMapping['2'].emoji} = Cerrada`,
                    `${metroConfig.statusMapping['3'].emoji} = Parcial`,
                    `${metroConfig.statusMapping['4'].emoji} = Retrasos`,
                    `${metroConfig.statusMapping['5'].emoji} = Extendida`,
                    '↔️ = Combinación'
                ].join('\n'),
                inline: true
            });

            return embed;
        } catch (error) {
            logger.error('Failed to build overview embed', error);
            return this.buildErrorEmbed('Error al generar el estado general');
        }
    }

    static buildLineEmbed(lineData, allStations = [], metroCore = {}) {
    try {
        // Validate input
        if (!lineData || !lineData.id) {
            throw new Error('Invalid line data: missing line ID');
        }

        const lineKey = lineData.id.toLowerCase();
        const lineIdUpper = lineKey.toUpperCase();
        logger.debug(`Building embed for line ${lineKey}`);

        // Get service information
        const serviceStatus = TimeHelpers.getServiceStatus();
        const lineClosedStations = TimeHelpers.getClosedStations(lineIdUpper);
        const statusInfo = metroConfig.statusMapping[lineData.status?.code] || 
                         metroConfig.statusMapping['1'];

        // Create base embed
        const embed = new EmbedBuilder()
            .setTitle(`${this._getLineEmoji(lineKey)} Línea ${lineIdUpper} - ${TimeHelpers.formatForEmbed()} CLT`)
            .setColor(lineData.color || metroConfig.lineColors?.[lineKey] || '#5865F2');

        // Filter stations - with additional validation
        const lineStations = allStations.filter(station => {
            if (!station || !station.line) return false;
            return station.line.toLowerCase() === lineKey;
        });

        logger.debug(`Found ${lineStations.length} stations for line ${lineKey}`);

        // Build description with error fallbacks
        const descriptionParts = [
            `**Estado:** ${statusInfo.emoji} ${statusInfo.message}`,
            lineData.status?.appMessage ? `**Info App:** ${lineData.status.appMessage}` : '',
            `**Horario:** ${serviceStatus.operatingHours.opening} - ${serviceStatus.operatingHours.closing}`
        ];

        // Add extended hours if applicable
        if (serviceStatus.operatingHours.isExtended) {
            descriptionParts.push(
                `📅 Horario extendido por: ${serviceStatus.operatingHours.eventName || 'evento especial'}`
            );
        }

        // Add express service if applicable
        if (metroConfig.expressLines?.includes(lineKey)) {
            descriptionParts.push(
                serviceStatus.expressActive ? 
                '🚄 **Servicio Express activo**' : 
                '🚄 Servicio Express no disponible'
            );
        }

        // Add closed stations notice
        if (lineClosedStations.length > 0) {
            descriptionParts.push(
                `\n🚧 **Estaciones cerradas:** ${lineClosedStations.length}`
            );
        }

        embed.setDescription(descriptionParts.filter(Boolean).join('\n'));

        // Handle station display with robust error handling
        if (lineStations.length > 0) {
            try {
                const MAX_FIELD_SIZE = 1024;
                let currentField = { name: `🚉 Estaciones (${lineStations.length})`, value: '', inline: false };
                const stationFields = [];

                for (const station of lineStations) {
                    try {
                        const decoratedStation = decorateStation(
                           station,
                            
                         metroCore);

                        if (currentField.value.length + decoratedStation.length + 1 > MAX_FIELD_SIZE) {
                            stationFields.push(currentField);
                            currentField = { name: '↪️ Continuación', value: '', inline: false };
                        }

                        currentField.value += `${decoratedStation}\n`;
                    } catch (stationError) {
                        logger.warn(`Error decorating station ${station?.id}`, {
                            error: stationError.message,
                            station
                        });
                        continue;
                    }
                }

                if (currentField.value) {
                    stationFields.push(currentField);
                }

                stationFields.forEach(field => embed.addFields(field));
            } catch (displayError) {
                logger.error('Failed to display stations', {
                    error: displayError.message,
                    line: lineKey
                });
                embed.addFields({
                    name: '⚠️ Error',
                    value: 'No se pudieron cargar todas las estaciones',
                    inline: false
                });
            }
        } else {
            embed.addFields({
                name: '🚉 Estaciones',
                value: 'No hay información de estaciones disponible',
                inline: false
            });
        }

        // Add express service details if applicable
        if (metroConfig.expressLines?.includes(lineKey)) {
            embed.addFields({
                name: '🚄 Horario Express',
                value: TimeHelpers.isExpressActive() ? 
                    `Operativo (${metroConfig.horarioExpreso.morning[0]}-${metroConfig.horarioExpreso.morning[1]} y ${metroConfig.horarioExpreso.evening[0]}-${metroConfig.horarioExpreso.evening[1]})` : 
                    'Fuera de horario',
                inline: true
            });
        }

        // Add next transition
        try {
            const nextTransition = TimeHelpers.getNextTransition();
            embed.addFields({
                name: '⏭️ Próximo Cambio',
                value: `${nextTransition.time}: ${nextTransition.message}`,
                inline: true
            });
        } catch (transitionError) {
            logger.warn('Failed to get next transition', {
                error: transitionError.message,
                line: lineKey
            });
        }

        embed.setFooter({
            text: `Actualizado: ${TimeHelpers.formatForEmbed()}`,
            iconURL: metroConfig.metroLogo.principal
        });

        return embed;
    } catch (error) {
        logger.error(`Failed to build line embed for ${lineData?.id || 'unknown'}`, {
            error: error.message,
            stack: error.stack,
            lineData,
            allStationsLength: allStations?.length
        });
        
        return this.buildErrorEmbed(`Error al mostrar línea ${lineData?.id || 'desconocida'}`);
    }
}

    // Helper methods
    static _getStatusColor(statusCode) {
        switch(String(statusCode)) {
            case '0': return '#95a5a6'; // Closed
            case '1': return '#2ecc71'; // Operational
            case '2': return '#e74c3c'; // Closed
            case '3': return '#f39c12'; // Partial
            case '4': return '#e67e22'; // Delayed
            case '5': return '#4CAF50'; // Extended
            default: return '#5865F2';
        }
    }

    static _getLineEmoji(lineId) {
        return metroConfig.linesEmojis?.[lineId.toLowerCase()] || '🚇';
    }

    static buildErrorEmbed(message = 'Error desconocido') {
        return new EmbedBuilder()
            .setTitle('⚠️ Error del Sistema')
            .setDescription(message)
            .setColor('#ff0000')
            .setTimestamp();
    }
}

module.exports = StatusEmbedBuilder;