const { EmbedBuilder } = require('discord.js');
const metroConfig = require('../../config/metro/metroConfig');

class ChangeAnnouncer {
    constructor() {
        this.statusMap = {
            '0' : { 
                emoji: metroConfig.statusMapping['0'].emoji,
                text: metroConfig.statusMapping['0'].message,
                color: '#7289DA',
                changeTitle: (isStation) => isStation ? 'Estación Cerrada por Horario' : 'Línea Cerrada por Horario',
                note: (prevStatus) => `📝 Estado anterior: ${this._humanStatus(prevStatus)}`
            },
            '1' : { 
                emoji: metroConfig.statusMapping['1'].emoji,
                text: metroConfig.statusMapping['1'].message,
                color: '#00AA00',
                changeTitle: (isStation) => isStation ? 'Estación Operativa Nuevamente' : 'Línea Operativa Nuevamente',
                note: (prevStatus) => `📝 Estado anterior: ${this._humanStatus(prevStatus)}`,
                victoryMessage: (prevStatus) => {
                    const prevText = this._humanStatus(prevStatus);
                    if (prevStatus === 2 || prevStatus === 'closed') return '¡La línea ha vuelto a la operación completa después de un cierre total! 🎉';
                    if (prevStatus === 3 || prevStatus === 'partial') return '¡La línea ha vuelto a la normalidad después de interrupciones parciales! ✨';
                    if (prevStatus === 4 || prevStatus === 'delayed') return '¡Las demoras han finalizado y el servicio es normal! 🚄';
                    return '¡El servicio ha vuelto a la normalidad! ✅';
                },
                victoryEmoji: '🎉'
            },
            '2': { 
                emoji: metroConfig.statusMapping['2'].emoji,
                text: metroConfig.statusMapping['2'].message,
                color: '#FF0000',
                changeTitle: (isStation) => isStation ? 'Estación Cerrada' : 'Línea Cerrada',
                note: (prevStatus) => `📝 Estado anterior: ${this._humanStatus(prevStatus)}`
            },
            '3' : { 
                emoji: metroConfig.statusMapping['3'].emoji,
                text: metroConfig.statusMapping['3'].message,
                color: '#FFA500',
                changeTitle: (isStation) => isStation ? 'Accesos Cerrados' : 'Servicio Interrumpido',
                note: (prevStatus) => `📝 Estado anterior: ${this._humanStatus(prevStatus)}`
            },
            '4' : { 
                emoji: metroConfig.statusMapping['4'].emoji,
                text: metroConfig.statusMapping['4'].message,
                color: '#FFFF00',
                changeTitle: (isStation) => isStation ? 'Demoras en Estación' : 'Demoras en Línea',
                note: (prevStatus) => `📝 Estado anterior: ${this._humanStatus(prevStatus)}`
            },
            '5' : { 
                emoji: metroConfig.statusMapping['5'].emoji,
                text: metroConfig.statusMapping['5'].message,
                color: '#0000FF',
                changeTitle: (isStation) => isStation ? 'Ruta Extendida' : 'Servicio Extendido',
                note: (prevStatus) => `📝 Estado anterior: ${this._humanStatus(prevStatus)}`
            }
        };
    }
    
    _getStatusInfo(status, isStation = true) {
    const statusCode = typeof status === 'object' ? status.code : status;
    const statusConfig = this.statusMap[statusCode] || {};
    
    return {
        emoji: this.getStatusEmoji(status),
        text: this.getStatusText(status, isStation),
        color: this.getStatusColor(status),
        changeTitle: (isStationParam) => statusConfig.changeTitle 
            ? statusConfig.changeTitle(isStationParam) 
            : 'Cambio de Estado',
        note: statusConfig.note || ((prev) => `📝 Estado anterior: ${this._humanStatus(prev)}`),
        victoryMessage: statusConfig.victoryMessage,
        victoryEmoji: statusConfig.victoryEmoji
    };
}

    _humanStatus(status) {
        if (typeof status === 'object' && status.code) {
            return this.getStatusText(status);
        }
        return metroConfig.statusMapping[status]?.message || 
               metroConfig.stationIcons[status]?.message || 
               'Desconocido';
    }

    async generateMessages(changes, allStations = { stations: {}, lines: {} }) {
        try {
            const changeList = Array.isArray(changes) ? changes : changes.changes || [];
            
            if (changeList.length === 0) {
                return [this._createInfoEmbed('No hay cambios para anunciar')];
            }

            const grouped = this._groupChangesByLine(changeList);
            const messages = [];
            
            for (const [lineId, group] of Object.entries(grouped)) {
                try {
                    const embed = this._createLineEmbed(lineId, group, allStations);
                    messages.push(embed);
                } catch (error) {
                    console.error(`Error processing line ${lineId}:`, error);
                    messages.push(this._createErrorEmbed(`Error procesando cambios para Línea ${this._formatLineNumber(lineId)}`));
                }
            }

            return messages;
        } catch (error) {
            console.error('Error generating messages:', error);
            return [this._createErrorEmbed('Error al procesar actualizaciones')];
        }
    }

    getStatusEmoji(status) {
        if (typeof status === 'object' && status.code) {
            return metroConfig.statusMapping[status.code]?.emoji || 
                   metroConfig.stationIcons[status.code]?.emoji || 
                   status.appDescription || 
                   '⚪';
        }
        return metroConfig.statusMapping[status]?.emoji || 
               metroConfig.stationIcons[status]?.emoji || 
               '⚪';
    }

    getStatusText(status, isStation = true) {
        if (typeof status === 'object' && status.code) {
            return status.appDescription || 
                   metroConfig.statusMapping[status.code]?.message || 
                   metroConfig.stationIcons[status.code]?.message || 
                   'Desconocido';
        }
        return metroConfig.statusMapping[status]?.message || 
               metroConfig.stationIcons[status]?.message || 
               'Desconocido';
    }

    getStatusColor(status) {
        if (typeof status === 'object' && status.code) {
            return this.statusMap[status.code]?.color || '#7289DA';
        }
        return this.statusMap[status]?.color || '#7289DA';
    }

    _formatLineNumber(lineId) {
        return lineId.replace(/^l/, '').replace(/^(\d)\d$/, '$1');
    }

    _normalizeLineId(lineId) {
        if (typeof lineId !== 'string') lineId = String(lineId);
        return lineId.toLowerCase().replace(/^i/, 'l').replace(/^(\d+)$/, 'l$1');
    }
    
        _createLineEmbed(lineId, group, allStations) {

        const normalizedLineId = this._normalizeLineId(lineId);

        const lineNumber = this._formatLineNumber(normalizedLineId);

        const lineData = allStations.lines?.[normalizedLineId] || allStations.lines?.[lineNumber] || {};

        const lineEmoji = metroConfig.linesEmojis[normalizedLineId] || '🚇';

        

        const embed = new EmbedBuilder()

            .setTitle(`${lineEmoji} ${lineData.displayName || `Línea ${lineNumber}`}`)

            .setColor(lineData.color || this._getLineStatusColor(group));

        // Check for closed stations in both changes and current status

        const hasClosedStations = this._checkClosedStations(group, lineData, allStations);

        if (hasClosedStations) {

            embed.setTitle(`${embed.data.title} (No todas las estaciones operativas)`);

        }

        // Process line-level changes

        if (group.lineChanges.length > 0) {

            const lineChange = group.lineChanges[0];

            const statusInfo = this._getStatusInfo(lineChange.to, false);

            

            if (lineChange.to === 1 || (typeof lineChange.to === 'object' && lineChange.to.code === 1)) {

                this._addVictoryMessage(embed, statusInfo, lineChange.from);

            } else {

                embed.setDescription(`**${statusInfo.changeTitle(false)}**`);

            }

            

            this._addChangeDetails(embed, lineChange);

        } else {

            this._addCurrentStatus(embed, lineData);

        }

        // Process station changes

        if (group.stationChanges.length > 0) {

            this._addStationChanges(embed, normalizedLineId, group.stationChanges, allStations);

            this._addUnaffectedStationsInfo(embed, normalizedLineId, group.stationChanges, allStations);

        }

        embed.setFooter({ 

            text: `Sistema de Monitoreo Metro`,

            iconURL: metroConfig.metroLogo.principal

        });

        return embed;

    }

 _checkClosedStations(group, lineData, allStations) {

        return group.stationChanges.some(change => {

            const statusCode = typeof change.to === 'object' ? change.to.code : change.to;

            return statusCode === 2 || statusCode === 'closed';

        }) || (lineData.stations || []).some(stationId => {

            const station = allStations.stations?.[stationId];

            const statusCode = typeof station?.status === 'object' ? station.status.code : station?.status;

            return statusCode === 2 || statusCode === 'closed';

        });

    }

    _addVictoryMessage(embed, statusInfo, previousStatus) {

        const victoryMsg = statusInfo.victoryMessage ? statusInfo.victoryMessage(previousStatus) : '';

        embed.setDescription(`🎉 **${statusInfo.changeTitle(false)}** 🎉\n${victoryMsg}`);

    }

    _addChangeDetails(embed, lineChange) {
    const statusInfo = this._getStatusInfo(lineChange.to, false);
    
    if (lineChange.reason) {
        embed.addFields({
            name: '📌 Motivo',
            value: lineChange.reason,
            inline: false
        });
    }

    if (lineChange.duration) {
        embed.addFields({
            name: '⏱️ Duración estimada',
            value: lineChange.duration,
            inline: true
        });
    }

    embed.addFields({
        name: '📋 Historial de cambios',
        value: `${statusInfo.note(lineChange.from)}\n${metroConfig.logoMetroEmoji} *Actualizado: ${new Date().toLocaleString('es-ES')}*`,
        inline: false
    });
}

    _addCurrentStatus(embed, lineData) {

        const currentStatus = lineData.status || 'operational';

        const statusInfo = this._getStatusInfo(currentStatus, false);

        embed.setDescription(`**Estado actual:** ${statusInfo.emoji} ${statusInfo.text}`);

    }

    _addStationChanges(embed, lineId, stationChanges, allStations) {

        const stationSegments = this._findConsecutiveStations(lineId, stationChanges, allStations);

        stationSegments.forEach(segment => {

            embed.addFields(this._createStationSegmentField(segment, allStations));

        });

        embed.addFields({

            name: '📊 Resumen',

            value: `Total de estaciones afectadas: ${stationChanges.length}`,

            inline: false

        });

    }
    
    _checkClosedStations(group, lineData, allStations) {
    return group.stationChanges.some(change => {
        const statusCode = typeof change.to === 'object' ? change.to.code : change.to;
        return statusCode === 2 || statusCode === 'closed';
    }) || (lineData.stations || []).some(stationId => {
        const station = allStations.stations?.[stationId];
        const statusCode = typeof station?.status === 'object' ? station.status.code : station?.status;
        return statusCode === 2 || statusCode === 'closed';
    });
}

    _addUnaffectedStationsInfo(embed, lineId, changedStations, allStations) {

        const unaffectedInfo = this._getUnaffectedStationsInfo(lineId, changedStations, allStations);

        if (unaffectedInfo) {

            embed.addFields(unaffectedInfo);

        }

    }

    _getUnaffectedStationsInfo(lineId, changedStations, allStations) {
    const line = allStations.lines?.[lineId];
    
    if (!line || !Array.isArray(line.stations)) return null;

    const changedIds = changedStations.map(s => s.id);
    const operationalStatusCodes = [0, 1, 5, 'operational']; // Status codes considered operational

    const allStationsWithStatus = line.stations.map(id => ({
        id,
        ...this._getStationStatusInfo(id, allStations)
    }));

    // Filter out:
    // 1. Stations that were changed
    // 2. Stations that are operational
    const problematicUnaffected = allStationsWithStatus.filter(station => 
        !changedIds.includes(station.id) && 
        !operationalStatusCodes.includes(parseInt(
          station.status.code) 
        )
    );

    if (problematicUnaffected.length === 0) return null;

    const statusGroups = problematicUnaffected.reduce((groups, station) => {
        const statusInfo = this._getStatusInfo(station.status, true);
        const statusKey = `${statusInfo.emoji} ${statusInfo.text}`;

        groups[statusKey] = groups[statusKey] || {
            stations: []
        };
        groups[statusKey].stations.push(station.name);
        return groups;
    }, {});

    let fieldValue = '**Estaciones con problemas (no modificadas):**\n';
    
    for (const [statusText, group] of Object.entries(statusGroups)) {
        fieldValue += `- ${statusText}: ${group.stations.join(', ')}\n`;
    }

    return {
        name: 'ℹ️ Estado de estaciones no afectadas',
        value: fieldValue,
        inline: false
    };
}

    _getStationStatusInfo(stationId, allStations) {

        const station = allStations.stations?.[stationId];

        return {

            name: station?.displayName || station?.name || stationId,

            status: station?.status || 'operational',

            statusCode: typeof station?.status === 'object' ? station.status.code : station?.status

        };

    }

    _createStationSegmentField(segment, allStations) {
    const firstStation = allStations.stations?.[segment.firstStation];
    const lastStation = allStations.stations?.[segment.lastStation];
    
    // Check if we should group the stations (more than 5 and all have same status change)
    const shouldGroup = segment.count > 5 && this._hasUniformStatusChange(segment.changes);
    
    if (shouldGroup) {
        // Group display - show segment info only
        const statusInfo = this._getStatusInfo(segment.changes[0].to, true);
        const prevStatusInfo = segment.changes[0].from ? this._getStatusInfo(segment.changes[0].from, true) : null;
        
        let segmentText = `${statusInfo.emoji} **${segment.count} estaciones afectadas**`;
        segmentText += `\n↳ **Estado actual:** ${statusInfo.text}`;
        
        if (prevStatusInfo) {
            segmentText += `\n↳ **Estado anterior:** ${prevStatusInfo.text} ${prevStatusInfo.emoji}`;
        }
        
        // Add common reason if all changes have the same reason
        const commonReason = this._getCommonReason(segment.changes);
        if (commonReason) {
            segmentText += `\n↳ **Motivo:** ${commonReason}`;
        }
        
        const segmentTitle = `⛔ Tramo afectado: ${firstStation?.displayName || segment.firstStation} → ${lastStation?.displayName || segment.lastStation} (${segment.count} estaciones)`;
        
        return {
            name: segmentTitle,
            value: segmentText,
            inline: false
        };
    }
    
    // Original individual station display
    const stationNames = segment.stationIds.map(id => {
        const station = allStations.stations?.[id] || {};
        const change = segment.changes.find(c => c.id === id) || {};
        
        // Get current and previous status info
        const currentStatus = station.status || change.to || 'operational';
        const previousStatus = change.from || station.status || 'operational';
        
        const statusInfo = this._getStatusInfo(currentStatus, true);
        const prevStatusInfo = this._getStatusInfo(previousStatus, true);
        
        // Determine status icon based on change direction
        let statusIcon = 'ℹ️';
        if (previousStatus) {
            const prevCode = typeof previousStatus === 'object' ? previousStatus.code : previousStatus;
            const currCode = typeof currentStatus === 'object' ? currentStatus.code : currentStatus;
            statusIcon = currCode < prevCode ? '🔼' : currCode > prevCode ? '🔽' : 'ℹ️';
        }
        
        // Build station text
        let stationText = `${statusInfo.emoji} ${statusIcon} **${station.displayName || station.name || id}**`;
        stationText += `\n   ↳ **Estado actual:** ${statusInfo.text}`;
        
        // Add previous status if available
        if (previousStatus) {
            stationText += `\n   ↳ **Estado anterior:** ${prevStatusInfo.text} ${prevStatusInfo.emoji}`;
        }
        
        // Add description if available
        if (change.description) {
            stationText += `\n   ↳ **Descripción:** ${change.description}`;
        }
        
        // Add transfers information
        if (station.transfers?.length > 0 && 
            ((typeof currentStatus === 'object' && (currentStatus.code === 2 || currentStatus.code === 3)) || 
            currentStatus === 2 || currentStatus === 3)) {
            const transferEmoji = metroConfig.combIcons[currentStatus.code]?.emoji || '🚫';
            stationText += `\n   ↳ ${transferEmoji} **Transbordos:** ${metroConfig.combIcons[currentStatus.code]?.message || 'Combinaciones afectadas'}`;
        }
        
        // Add notes if available
        if (change.notes || station.notes) {
            stationText += `\n   ↳ 📢 **Nota:** ${change.notes || station.notes}`;
        }
        
        // Add severity if available
        if (change.severity) {
            stationText += `\n   ↳ ⚠️ **Severidad:** ${change.severity}`;
        }
        
        return stationText;
    }).join('\n\n');

    const segmentTitle = segment.count > 1 ? 
        `⛔ Tramo afectado: ${firstStation?.displayName || segment.firstStation} → ${lastStation?.displayName || segment.lastStation} (${segment.count} estaciones)` :
        `⚠️ Cambio de estado: ${firstStation?.displayName || segment.firstStation}`;

    return {
        name: segmentTitle,
        value: stationNames,
        inline: false
    };
}

// Helper method to check if all changes in a segment have the same status change
_hasUniformStatusChange(changes) {
    if (changes.length === 0) return true;
    
    const firstChange = changes[0];
    const firstToCode = typeof firstChange.to === 'object' ? firstChange.to.code : firstChange.to;
    const firstFromCode = typeof firstChange.from === 'object' ? firstChange.from.code : firstChange.from;
    
    return changes.every(change => {
        const toCode = typeof change.to === 'object' ? change.to.code : change.to;
        const fromCode = typeof change.from === 'object' ? change.from.code : change.from;
        return toCode === firstToCode && fromCode === firstFromCode;
    });
}

// Helper method to get common reason if all changes share the same reason
_getCommonReason(changes) {
    if (changes.length === 0) return null;
    
    const firstReason = changes[0].reason;
    if (!firstReason) return null;
    
    return changes.every(change => change.reason === firstReason) ? firstReason : null;
}

    _groupChangesByLine(changes) {

        const groups = {};

        

        changes.forEach(change => {

            let lineId = change.type === 'line' ? `${change.id}` : `${change.line || change.lineId}`;

            lineId = this._normalizeLineId(lineId);

            

            groups[lineId] = groups[lineId] || { lineChanges: [], stationChanges: [] };

            

            if (change.type === 'line') {

                groups[lineId].lineChanges.push(change);

            } else {

                groups[lineId].stationChanges.push({

                    ...change,

                    from: change.from,

                    to: change.to

                });

            }

        });

        

        return groups;

    }

    _findConsecutiveStations(lineId, stationChanges, allStations) {

        const normalizedLineId = this._normalizeLineId(lineId);

        const line = allStations.lines?.[normalizedLineId];

        if (!line || !Array.isArray(line.stations)) return [];

        const stationOrder = line.stations;

        const affectedStations = stationChanges.map(c => c.id);

        

        const segments = [];

        let currentSegment = [];

        

        for (const stationId of stationOrder) {

            if (affectedStations.includes(stationId)) {

                currentSegment.push(stationId);

            } else if (currentSegment.length > 0) {

                segments.push(currentSegment);

                currentSegment = [];

            }

        }

        

        if (currentSegment.length > 0) {

            segments.push(currentSegment);

        }

        

        return segments.map(segment => ({

            lineId: normalizedLineId,

            stationIds: segment,

            firstStation: segment[0],

            lastStation: segment[segment.length - 1],

            count: segment.length,

            changes: stationChanges.filter(change => segment.includes(change.id))

        }));

    }

    _getLineStatusColor(group) {

        if (group.lineChanges.some(c => 

            c.to === 'closed' || (typeof c.to === 'object' && c.to.code === 2))) return '#FF0000';

        if (group.lineChanges.some(c => 

            c.to === 'partial' || (typeof c.to === 'object' && c.to.code === 3))) return '#FFA500';

        if (group.lineChanges.some(c => 

            c.to === 'delayed' || (typeof c.to === 'object' && c.to.code === 4))) return '#FFFF00';

        if (group.lineChanges.some(c => 

            c.to === 'extended' || (typeof c.to === 'object' && c.to.code === 5))) return '#0000FF';

        if (group.stationChanges.length > 0) return '#FFA500';

        return '#7289DA';

    }

    _createErrorEmbed(message) {

        return new EmbedBuilder()

            .setTitle('⚠️ Error del Sistema')

            .setDescription(message)

            .setColor('#FF0000')

            .setFooter({ 

                text: `Error ocurrido: ${new Date().toLocaleString('es-ES')}`,

                iconURL: metroConfig.metroLogo.principal

            });

    }

    _createInfoEmbed(message) {

        return new EmbedBuilder()

            .setTitle('ℹ️ Información del Sistema')

            .setDescription(message)

            .setColor('#3498DB')

            .setFooter({ 

                text: `Actualizado: ${new Date().toLocaleString('es-ES')}`,

                iconURL: metroConfig.metroLogo.principal

            });

    }

    // In ChangeAnnouncer.js, add this new method to the class
async generateTelegramMessages(changes, allStations = { stations: {}, lines: {} }) {
    try {
        const changeList = Array.isArray(changes) ? changes : changes.changes || [];
        
        if (changeList.length === 0) {
            return [];
        }

        const grouped = this._groupChangesByLine(changeList);
        const messages = [];
        
        for (const [lineId, group] of Object.entries(grouped)) {
            try {
                // Skip status 0 changes (closed by schedule)
                if (group.lineChanges.some(c => 
                    (typeof c.to === 'object' && c.to.code === 0) || 
                    (typeof c.from === 'object' && c.from.code === 0) ||
                    c.to === 0 || c.from === 0)) {
                    continue;
                }

                const lineNumber = this._formatLineNumber(lineId);
                const lineData = allStations.lines?.[lineId] || {};
                
                // Process line changes
                let lineMessage = '';
                if (group.lineChanges.length > 0) {
                    const lineChange = group.lineChanges[0];
                    const statusInfo = this._getStatusInfo(lineChange.to, false);
                    
                    // Skip if changing to/from status 0
                    if ((typeof lineChange.to === 'object' && lineChange.to.code === '0') || 
                        (typeof lineChange.from === 'object' && lineChange.from.code === '0') ||
                        lineChange.to === '0' || lineChange.from === '0') {
                        continue;
                    }

                    const lineEmoji = metroConfig.linesEmojis[lineId] || '🚇';
                    const lineName = lineData.displayName || `Línea ${lineNumber}`;
                    
                    if (lineChange.to === '1' || (typeof lineChange.to === 'object' && lineChange.to.code === '1')) {
                        // Service normalized
                        lineMessage = `${statusInfo.emoji} Servicio en #${lineName} se encuentra normalizado`;
                        
                        if (statusInfo.victoryMessage) {
                            lineMessage += `\n${statusInfo.victoryMessage(lineChange.from)}`;
                        }
                    } else {
                        // Other line status changes
                        lineMessage = `${statusInfo.emoji} Informamos que *#${lineName} ${statusInfo.text.toLowerCase()}*`;
                        
                        if (lineChange.reason || lineChange.description) {
                            lineMessage += ` ${lineChange.reason || lineChange.description}`;
                        }
                    }
                    
                    messages.push(lineMessage);
                }
                
                // Process station changes (only include closed stations - status 2 or 3)
                const closedStations = group.stationChanges.filter(change => {
                    const statusCode = typeof change.to === 'object' ? change.to.code : change.to;
                    return (statusCode === '2' || statusCode === '3') && 
                           !((typeof change.from === 'object' && change.from.code === '0') || change.from === '0');
                });
                
                if (closedStations.length > 0) {
                    let stationsMessage = '';
                    const lineName = lineData.displayName || `Línea ${lineNumber}`;
                    
                    // Group by status
                    const groupedByStatus = closedStations.reduce((acc, change) => {
                        const statusCode = typeof change.to === 'object' ? change.to.code : change.to;
                        const statusKey = statusCode === '2' ? 'closed' : 'partial';
                        
                        acc[statusKey] = acc[statusKey] || [];
                        const station = allStations.stations?.[change.id] || {};
                        acc[statusKey].push(station.displayName || change.id);
                        return acc;
                    }, {});
                    
                    if (groupedByStatus.closed?.length > 0) {
                        stationsMessage += `Las siguientes estaciones se encuentran sin servicio:\n\n`;
                        stationsMessage += groupedByStatus.closed.map(name => `❌ ${name}`).join('\n');
                    }
                    
                    if (groupedByStatus.partial?.length > 0) {
                        if (stationsMessage) stationsMessage += '\n\n';
                        stationsMessage += `Estaciones con accesos cerrados:\n\n`;
                        stationsMessage += groupedByStatus.partial.map(name => `🟡 ${name}`).join('\n');
                    }
                    
                    // Add common reason if available
                    const commonReason = this._getCommonReason(closedStations);
                    if (commonReason) {
                        stationsMessage += `\n\nℹ️ Motivo: ${commonReason}`;
                    }
                    
                    if (stationsMessage) {
                        messages.push(stationsMessage);
                    }
                }
                
            } catch (error) {
                console.error(`Error processing line ${lineId} for Telegram:`, error);
            }
        }

        console.log("Mensajes al final: ",messages)

        return messages;
    } catch (error) {
        console.error('Error generating Telegram messages:', error);
        return [];
    }
}

}

module.exports = ChangeAnnouncer;
    
