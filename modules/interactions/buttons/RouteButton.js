// File: RouteButton.js
// File: RouteButton.js
// File: RouteButton.js
const { EmbedBuilder, ActionRowBuilder, ButtonStyle, ButtonBuilder } = require('discord.js');
const BaseButton = require('./templates/baseButton');
const interactionStore = require('../utils/interactionStore');
const config = require('../../../config/metro/metroConfig');
const styles = require('../../../config/metro/styles.json');

class RouteButton extends BaseButton {
    constructor() {
        super({
            customIdPrefix: 'routeInfo',
            style: ButtonStyle.Secondary
        });
        
        this.tabs = {
            overview: { label: `👀 Resumen`, style: ButtonStyle.Primary },
            fastest: { label: '🚅 Más Rápido', style: ButtonStyle.Success },
            balanced: { label: '⚖️ Equilibrado', style: ButtonStyle.Secondary },
            slowest: { label: '🐢 Más Lento', style: ButtonStyle.Danger }
        };
        
        this.cacheDuration = 30 * 60 * 1000; // 30 minutes cache
    }

    async build(routeOptions, metro) {
        const cacheKey = this._getCacheKey(routeOptions.id);
        const metroData = metro.api.getProcessedData();
        const extraData = metro._staticData; 
        
        interactionStore.set(cacheKey, {
            route: routeOptions,
            metroData: metroData,
            staticData: extraData, 
            timestamp: Date.now()
        }, this.cacheDuration);

        return this._createRouteMessage(routeOptions);
    }

    async handleInteraction(interaction, metadata) {
        console.log(`[RouteButton] Interaction started | User: ${interaction.user.id} | CustomID: ${interaction.customId}`);
        console.log(`[RouteButton] Interaction state - Deferred: ${interaction.deferred}, Replied: ${interaction.replied}`);

        try {
            const [action, routeId, tabId = 'overview'] = interaction.customId.split(':');
            console.log(`[RouteButton] Parsed components - Action: ${action}, RouteID: ${routeId}, TabID: ${tabId}`);

            const cacheKey = this._getCacheKey(routeId);
            console.log(`[RouteButton] Cache lookup - Key: ${cacheKey}`);
            
            const cacheData = interactionStore.get(cacheKey);
            if (!cacheData) {
                console.warn(`[RouteButton] Cache miss for route ${routeId}`);
                const response = {
                    content: '⚠️ Route data expired. Please plan your route again.',
                    ephemeral: true
                };

                if (interaction.deferred || interaction.replied) {
                    console.log('[RouteButton] Editing existing reply for expired data');
                    await interaction.editReply(response);
                } else {
                    console.log('[RouteButton] Sending new reply for expired data');
                    await interaction.reply(response);
                }
                return;
            }

            console.log(`[RouteButton] Cache hit | Timestamp: ${new Date(cacheData.timestamp).toISOString()}`);
            console.log(`[RouteButton] Route data - Origin: ${cacheData.route.origin.name}, Dest: ${cacheData.route.destination.name}`);

            const message = this._createRouteMessage(cacheData.route, tabId, {
                staticData: cacheData.staticData,
                metroData: cacheData.metroData
            });
            console.log(`[RouteButton] Message prepared | Tab: ${tabId} | Embed: ${message.embeds[0]?.title}`);

            await interaction.editReply(message);
            console.log('[RouteButton] Interaction completed successfully');
        } catch (error) {
            console.error(`[RouteButton] Interaction failed:`, error);
            console.error(`[RouteButton] Error details:`, {
                customId: interaction.customId,
                user: interaction.user.id,
                stack: error.stack
            });

            const errorResponse = {
                content: '❌ Error processing route request. Please try again.',
                ephemeral: true
            };

            try {
                if (interaction.deferred || interaction.replied) {
                    console.log('[RouteButton] Sending error follow-up');
                    await interaction.followUp(errorResponse);
                } else {
                    console.log('[RouteButton] Sending error reply');
                    await interaction.reply(errorResponse);
                }
            } catch (responseError) {
                console.error('[RouteButton] CRITICAL: All response methods failed:', responseError);
                try {
                    await interaction.user.send({
                        content: '⚠️ Your route request failed. Please try the command again.'
                    });
                } catch (dmError) {
                    console.error('[RouteButton] Failed to send DM fallback:', dmError);
                }
            }
        }
    }

    _createRouteMessage(routeData, activeTab = 'overview', metadata = {}) {
        return {
            content: "", 
            embeds: [this._createRouteEmbed(routeData, activeTab, metadata)],
            components: this._createRouteButtons(routeData.id, activeTab)
        };
    }

    _createRouteButtons(routeId, activeTab) {
        const row = new ActionRowBuilder();
        
        Object.entries(this.tabs).forEach(([tabId, tabConfig]) => {
            if (tabId === 'balanced' && !this._hasBalancedOption(routeId)) return;
            
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`routeInfo:${routeId}:${tabId}`)
                    .setLabel(tabConfig.label)
                    .setStyle(tabId === activeTab ? ButtonStyle.Primary : tabConfig.style)
                    .setDisabled(tabId === activeTab)
            );
        });

        return [row];
    }

    _hasBalancedOption(routeId) {
        const cacheData = interactionStore.get(this._getCacheKey(routeId));
        return cacheData?.route?.options?.balanced !== undefined;
    }

    _createRouteEmbed(routeData, tabId = 'overview', metadata = {}) {
        switch (tabId) {
            case 'fastest':
                return this._createRouteDetailEmbed(routeData.options.fastest, '🚄 Ruta Más Rápida', '#2ecc71', metadata);
            case 'balanced':
                return this._createRouteDetailEmbed(routeData.options.balanced, '⚖️ Ruta Equilibrada', '#3498db', metadata);
            case 'slowest':
                return this._createRouteDetailEmbed(routeData.options.slowest, '🐢 Ruta Más Lenta', '#e74c3c', metadata);
            default:
                return this._createOverviewEmbed(routeData);
        }
    }

    _createOverviewEmbed(routeData) {
        const origin = routeData.origin;
        const destination = routeData.destination;
        
        const embed = new EmbedBuilder()
            .setTitle(`${config.logoMetroEmoji} Ruta: ${config.linesEmojis[origin.line.toLowerCase()]} ${origin.name} → ${config.linesEmojis[destination.line.toLowerCase()]} ${destination.name}`)
            .setColor(this._getRouteColor(routeData))
            .setDescription(`**⌚ Período Tarifario:** ${routeData.farePeriod}\n🚶 Selecciona un tipo de ruta abajo:`);

        if (routeData.options) {
            const optionsText = [];
            if (routeData.options.fastest) {
                optionsText.push(`🚄 **Más rápido:** ${routeData.options.fastest.totalTime} min (${routeData.options.fastest.transferCount} trasbordos)`);
            }
            if (routeData.options.balanced) {
                optionsText.push(`⚖️ **Equilibrado:** ${routeData.options.balanced.totalTime} min (${routeData.options.balanced.transferCount} trasbordos)`);
            }
            if (routeData.options.slowest) {
                optionsText.push(`🐢 **Más lento:** ${routeData.options.slowest.totalTime} min (${routeData.options.slowest.transferCount} trasbordos)`);
            }
            
            embed.addFields({
                name: '🚇 Opciones Disponibles',
                value: optionsText.join('\n') || 'No hay opciones disponibles',
                inline: false
            });
        }

        return embed;
    }

    _createSegmentDescription(segment, index, allSegments, staticData, allData) {
        const segmentNum = `${index + 1}.`;
        
        if (segment.type === 'combinacion' || segment.type === 'cambio') {
            const nextSegment = allSegments[index + 1];
            const directionInfo = this._getTransferDirection(segment, nextSegment, allData);
            return `${segmentNum} 🚶‍♂️ **Trasbordo** en *${segment.transferStation.name}*\n` +
                   `→ Línea ${config.linesEmojis[segment.transferLine.toLowerCase()]} \`${directionInfo}\``;
        }

        const startStation = staticData.stations?.[segment.from.name];
        const endStation = staticData.stations?.[segment.to.name];
        
        
        
        const stationCount = this._countStationsBetween(
            segment.from.code,
            segment.to.code,
            segment.from.line,
            staticData,
            allData
        );

        let routeInfo = '';
        if (startStation?.ruta && startStation.ruta !== 'Común') {
            routeInfo = `${config.stationIcons[startStation.ruta.toLowerCase().replace("ruta ", "")].emoji} Tren \`${startStation.ruta}\``;
        } else if (endStation?.ruta && endStation.ruta !== 'Común') {
            routeInfo = `${config.stationIcons[endStation.ruta.toLowerCase().replace("ruta ", "")].emoji} Tren \`${endStation.ruta}\``;
        }

        if (routeInfo) {
            routeInfo += ` *[${stationCount} estaciones]*`;
        } else {
            routeInfo = `*[${stationCount} estaciones]*`;
        }

        return `${segmentNum} 🚇 **Viaje** Línea ${config.linesEmojis[segment.from?.line.toLowerCase()] ?? ""} ${routeInfo} Dirección \`${segment.direction}\`\n` +
               `**${segment.from.name}** ⏩ **${segment.to.name}**`;
    }

    _getTransferDirection(transferStation) {
        return transferStation.direction;
    }

    _createRouteDetailEmbed(routeOption, title, color, metadata = {}) {
    if (!routeOption) {
        return new EmbedBuilder()
            .setTitle('Opción no disponible')
            .setColor('#95a5a6')
            .setDescription('Esta opción de ruta no está disponible para este viaje.');
    }

    const staticData = metadata.staticData || {};
    const embed = new EmbedBuilder()
        .setTitle(`${config.logoMetroEmoji} ${title}`)
        .setColor(color)
        .addFields(
            { name: '⏱️ Tiempo Total', value: `${routeOption.totalTime} minutos`, inline: true },
            { name: '🔄 Trasbordos', value: `${routeOption.transferCount}`, inline: true },
            { name: '🚇 Estaciones', value: `${routeOption.stationCount}`, inline: true }
        );

    let hasProblems = false;
    const lineProblems = new Set();
    const stationProblems = [];

    const fullSegmentsText = routeOption.segments.map((segment, index) => {
        let segmentText = this._createSegmentDescription(segment, index, routeOption.segments, staticData, metadata.metroData);
        
        if (segment.type === "tramo") {
            // Check line status
            const lineData = metadata.metroData.lines[segment.from?.line.toLowerCase()];
            if (lineData && (lineData.status.code === "2" || lineData.status.code === "3" || lineData.status.code === "4")) {
                hasProblems = true;
                const lineKey = segment.from?.line.toLowerCase();
                if (!lineProblems.has(lineKey)) {
                    lineProblems.add(lineKey);
                }
            }

            // Check station status
            const startStation = metadata.metroData.stations[segment.from?.code.toLowerCase()];
            const endStation = metadata.metroData.stations[segment.to?.code.toLowerCase()];
            
            if (startStation && (startStation.status.code === "2" || startStation.status.code === "3" || startStation.status.code === "4")) {
                stationProblems.push({
                    name: startStation.displayName,
                    message: startStation.status.appMessage
                });
            }
            
            if (endStation && (endStation.status.code === "1" || endStation.status.code === "3" || endStation.status.code === "4")) {
                stationProblems.push({
                    name: endStation.displayName,
                    message: endStation.status.appMessage
                });
            }
        }

        return segmentText;
    }).join('\n\n');

    // Add alert field if there are problems
    if (hasProblems) {
        let alertMessages = [];
        
        // Add line problems
        lineProblems.forEach(lineKey => {
            const lineData = metadata.metroData.lines[lineKey];
            const emoji = lineData.status.code === "3" ? '⛔' : '⚠️';
            alertMessages.push(`${emoji} ${config.linesEmojis[lineKey]} Línea ${lineKey.toUpperCase()}: ${lineData.status.appMessage}`);
        });

        // Add station problems
        stationProblems.forEach(station => {
            alertMessages.push(`⚠️ Estación ${station.name}: ${station.message}`);
        });

        embed.addFields({
            name: '🚨 Alertas de Servicio',
            value: alertMessages.join('\n'),
            inline: false
        });

        // Update title to indicate problems
        embed.setTitle(`${config.logoMetroEmoji} ⚠️ ${title} (Dificultades en el trayecto)`);
    }

    if (fullSegmentsText.length <= 1024) {
        embed.addFields({
            name: '📝 Itinerario Detallado',
            value: fullSegmentsText,
            inline: false
        });
    } else {
        const chunks = this._splitTextIntoChunks(fullSegmentsText, 1024);
        chunks.forEach((chunk, i) => {
            embed.addFields({
                name: i === 0 ? '📝 Itinerario Detallado' : '↳ Continuación',
                value: chunk,
                inline: false
            });
        });
    }

    return embed;
}
    _countStationsBetween(startStationId, endStationId, line, staticData, allData) {
        const lineKey = line.toLowerCase();
        const lineData = allData?.lines[lineKey];
        
        if (!lineData) return 0;

        const stationsData = staticData?.stations || {};
        const stationOrder = lineData.stations || [];
        const startIdx = stationOrder.indexOf(startStationId.toLowerCase());
        const endIdx = stationOrder.indexOf(endStationId.toLowerCase());
        
        if (startIdx === -1 || endIdx === -1) return 0;
        
        const direction = startIdx < endIdx ? 1 : -1;
        const startStation = stationsData[this._getStationNameById(startStationId, allData.stations)];
        const endStation = stationsData[this._getStationNameById(endStationId, allData.stations)];

        let verdeCount = 0;
        let rojaCount = 0;
        let commonCount = 0;
        let normal = 0;
        
        for (let i = startIdx + direction; i !== endIdx + direction; i += direction) {
            const stationId = stationOrder[i]; 
            const stationName = this._getStationNameById(stationId, allData.stations);
            const station = stationsData[stationName];
            
            if (!station) continue;

            if (station.ruta === "Ruta Verde") {
                verdeCount++;
            } else if (station.ruta === "Ruta Roja") {
                rojaCount++;
            } else if (station.ruta === "Común") {
                commonCount++;
            } else {
                normal++;
            }
        }

        const startRoute = startStation?.ruta;
        const endRoute = endStation?.ruta;

        if (startRoute === "Ruta Verde" && endRoute === "Ruta Verde") {
            return verdeCount + commonCount;
        } else if (startRoute === "Ruta Roja" && endRoute === "Ruta Roja") {
            return rojaCount + commonCount;
        }

        if (startRoute === "Común" || endRoute === "Común") {
            if (startRoute === "Ruta Verde" || endRoute === "Ruta Verde") {
                return verdeCount + commonCount;
            }
            if (startRoute === "Ruta Roja" || endRoute === "Ruta Roja") {
                return rojaCount + commonCount;
            }
            return `${config.stationIcons.verde.emoji} ${verdeCount + commonCount} o ${config.stationIcons.roja.emoji} ${rojaCount + commonCount}`;
        }
        
        return `${normal}`;
    }

    _getStationNameById(stationId, stations) {
        if (!stations) return stationId;
        return stations[stationId.toLowerCase()].displayName || stationId;
    }
    
    _splitTextIntoChunks(text, maxLength) {
        const chunks = [];
        let currentChunk = '';
        const segments = text.split('\n\n');
        
        for (const segment of segments) {
            if (currentChunk.length + segment.length + 2 > maxLength) {
                if (currentChunk.length > 0) {
                    chunks.push(currentChunk);
                    currentChunk = '';
                }
                
                if (segment.length > maxLength) {
                    const lines = segment.split('\n');
                    let lineChunk = '';
                    
                    for (const line of lines) {
                        if (lineChunk.length + line.length + 1 > maxLength) {
                            if (lineChunk.length > 0) {
                                chunks.push(lineChunk);
                                lineChunk = '';
                            }
                            
                            if (line.length > maxLength) {
                                const words = line.split(' ');
                                let wordChunk = '';
                                
                                for (const word of words) {
                                    if (wordChunk.length + word.length + 1 > maxLength) {
                                        if (wordChunk.length > 0) {
                                            chunks.push(wordChunk);
                                            wordChunk = '';
                                        }
                                        chunks.push(word.substring(0, maxLength));
                                        wordChunk = word.substring(maxLength);
                                    } else {
                                        wordChunk += (wordChunk.length > 0 ? ' ' : '') + word;
                                    }
                                }
                                
                                if (wordChunk.length > 0) {
                                    chunks.push(wordChunk);
                                }
                            } else {
                                chunks.push(line);
                            }
                        } else {
                            lineChunk += (lineChunk.length > 0 ? '\n' : '') + line;
                        }
                    }
                    
                    if (lineChunk.length > 0) {
                        chunks.push(lineChunk);
                    }
                } else {
                    chunks.push(segment);
                }
            } else {
                currentChunk += (currentChunk.length > 0 ? '\n\n' : '') + segment;
            }
        }
        
        if (currentChunk.length > 0) {
            chunks.push(currentChunk);
        }
        
        return chunks;
    }

    _getRouteColor(routeData) {
        if (routeData.options?.fastest?.segments?.length > 0) {
            const firstSegment = routeData.options.fastest.segments[0];
            const line = firstSegment.type === 'combinacion' 
                ? firstSegment.transferLine 
                : firstSegment.from.line;
            return this._getLineColor(line.toLowerCase());
        }
        return styles.defaultTheme.primaryColor;
    }

    _getLineColor(line) {
        return styles.lineColors[line.toLowerCase()] || 0x000000;
    }

    _getCacheKey(routeId) {
        return `route_${routeId}`;
    }
}

module.exports = RouteButton;
