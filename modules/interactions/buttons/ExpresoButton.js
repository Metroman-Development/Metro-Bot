const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const BaseButton = require('./templates/baseButton');
const interactionStore = require('../utils/interactionStore');
const config = require('../../../config/metro/metroConfig');

class ExpresoButton extends BaseButton {
    constructor() {
        super({
            customIdPrefix: 'expreso',
            style: ButtonStyle.Secondary
        });
        
        // Enhanced route type configuration with custom emojis
        this.routeTypes = {
            todas: { 
                label: 'Todas', 
                style: ButtonStyle.Primary,
                emoji: config.stationIcons.redoperativa.emoji,
                filter: (station) => true,
                exclusive: true,
                description: 'Mostrar todas las estaciones sin filtros'
            },
            verde: { 
                label: 'Verde', 
                style: ButtonStyle.Success,
                emoji: config.stationIcons.verde.emoji,
                filter: (station) => station.ruta === 'Ruta Verde',
                exclusive: false,
                description: 'Mostrar solo estaciones de la Ruta Verde'
            },
            roja: { 
                label: 'Roja', 
                style: ButtonStyle.Danger,
                emoji: config.stationIcons.roja.emoji,
                filter: (station) => station.ruta === 'Ruta Roja',
                exclusive: false,
                description: 'Mostrar solo estaciones de la Ruta Roja'
            },
            comun: { 
                label: 'Común', 
                style: ButtonStyle.Secondary,
                emoji: config.stationIcons.comun.emoji,
                filter: (station) => !station.ruta || station.ruta === 'Común',
                exclusive: false,
                description: 'Mostrar estaciones de ruta común'
            }
        };
        
        // Display configuration
        this.stationsPerPage = 10;
        this.cacheDuration = 30 * 60 * 1000; // 30 minutes cache
        this.maxRouteCombinations = 3; // Maximum number of routes that can be combined
    }

    /**
     * Initializes and builds the express route interface
     */
    async build(lineValue, metro) {
        const cacheKey = this._getCacheKey(lineValue);
        const metroData = metro.api.getProcessedData();
        const staticData = metro._staticData;
        
        // Validate and process line data
        if (!metroData.lines[lineValue]) {
            throw new Error(`Line ${lineValue} not found in metro data`);
        }

        const line = metroData.lines[lineValue];
        const allStations = Object.values(staticData.stations)
            .filter(s => s.line === lineValue)
            .sort((a, b) => a.order - b.order);

        // Prepare filtered station sets
        const filteredStations = {
            todas: allStations,
            verde: allStations.filter(s => this.routeTypes.verde.filter(s)),
            roja: allStations.filter(s => this.routeTypes.roja.filter(s)),
            comun: allStations.filter(s => this.routeTypes.comun.filter(s))
        };

        // Initialize cache data
        const cacheData = {
            line: line,
            staticData: staticData,
            filteredStations: filteredStations,
            currentPage: 0,
            activeRoutes: ['todas'],
            timestamp: Date.now(),
            lastUpdated: new Date().toLocaleTimeString('es-CL')
        };
        
        interactionStore.set(cacheKey, cacheData, this.cacheDuration);
        return this._createExpresoMessage(lineValue, cacheData);
    }

    /**
     * Handles all button interactions
     */
    async handleInteraction(interaction) {
        try {
            const [prefix, lineValue, action, pageAction] = interaction.customId.split(':');
            const cacheKey = this._getCacheKey(lineValue);
            let cacheData = interactionStore.get(cacheKey);

            if (!cacheData) {
                return this._handleExpiredData(interaction);
            }

            // Process different interaction types
            if (action === 'page') {
                // Handle pagination
                const currentStations = this._getCurrentStations(cacheData);
                cacheData.currentPage = this._calculateNewPage(
                    pageAction, 
                    cacheData.currentPage, 
                    currentStations.length
                );
            } else if (Object.keys(this.routeTypes).includes(action)) {
                // Handle route selection
                this._updateActiveRoutes(cacheData, action);
                cacheData.currentPage = 0; // Reset to first page on route change
                cacheData.lastUpdated = new Date().toLocaleTimeString('es-CL');
            }

            // Update cache and respond
            interactionStore.set(cacheKey, cacheData, this.cacheDuration);
            await interaction.editReply(this._createExpresoMessage(lineValue, cacheData));
        } catch (error) {
            console.error('Error handling ExpresoButton interaction:', error);
            await this._handleError(interaction);
        }
    }

    /**
     * Updates the active routes based on user selection
     */
    _updateActiveRoutes(cacheData, selectedRoute) {
        const routeConfig = this.routeTypes[selectedRoute];
        
        // Handle exclusive routes (like 'todas')
        if (routeConfig.exclusive) {
            cacheData.activeRoutes = [selectedRoute];
            return;
        }
        
        // If selecting a new route while 'todas' is active
        if (cacheData.activeRoutes.includes('todas')) {
            cacheData.activeRoutes = [selectedRoute];
            return;
        }
        
        // Toggle route selection
        const routeIndex = cacheData.activeRoutes.indexOf(selectedRoute);
        if (routeIndex >= 0) {
            // Deselect the route
            cacheData.activeRoutes.splice(routeIndex, 1);
            
            // Default to 'todas' if no routes selected
            if (cacheData.activeRoutes.length === 0) {
                cacheData.activeRoutes = ['todas'];
            }
        } else {
            // Add new route (respecting maximum combinations)
            if (cacheData.activeRoutes.length < this.maxRouteCombinations) {
                cacheData.activeRoutes.push(selectedRoute);
            }
        }
    }

    /**
     * Gets stations for currently active routes
     */
    _getCurrentStations(cacheData) {
        // Return all stations if 'todas' is selected
        if (cacheData.activeRoutes.includes('todas')) {
            return cacheData.filteredStations.todas;
        }
        
        // Combine stations from all selected routes
        const combinedStations = new Set();
        for (const route of cacheData.activeRoutes) {
            for (const station of cacheData.filteredStations[route]) {
                combinedStations.add(station);
            }
        }
        
        // Convert back to array and sort by station order
        return Array.from(combinedStations)
            .sort((a, b) => a.order - b.order);
    }

    /**
     * Creates the complete message with embed and components
     */
    _createExpresoMessage(lineValue, cacheData) {
        return {
            embeds: [this._createExpresoEmbed(lineValue, cacheData)],
            components: this._createExpresoComponents(lineValue, cacheData)
        };
    }

    /**
     * Creates the main embed with station information
     */
    _createExpresoEmbed(lineValue, cacheData) {
        const line = cacheData?.line;
        if (!line) {
            return new EmbedBuilder()
                .setTitle('⚠️ Datos no disponibles')
                .setDescription('La información de la línea ha expirado.')
                .setColor('#ff0000');
        }

        // Get current station selection
        const stations = this._getCurrentStations(cacheData);
        const totalPages = Math.ceil(stations.length / this.stationsPerPage);
        const paginatedStations = stations.slice(
            cacheData.currentPage * this.stationsPerPage,
            (cacheData.currentPage + 1) * this.stationsPerPage
        );

        // Prepare display elements
        const lineEmoji = config.linesEmojis[lineValue] || '🚇';
        const activeRoutesText = this._getActiveRoutesDisplay(cacheData.activeRoutes);
        const routeDescriptions = this._getRouteDescriptions(cacheData.activeRoutes);

        // Create embed
        const embed = new EmbedBuilder()
            .setTitle(`${lineEmoji} ${line.displayName} - Selección de Rutas`)
            .setDescription([
                `**Rutas activas:** ${activeRoutesText}`,
                `**Descripción:** ${routeDescriptions}`,
                `**Actualizado:** ${cacheData.lastUpdated}`
            ].join('\n'))
            .setColor(line.color || '#0099ff')
            .setThumbnail(line.icon || null);

        // Add stations field if any stations available
        if (paginatedStations.length > 0) {
            embed.addFields({
                name: `Estaciones (${stations.length})`,
                value: paginatedStations.map(s => 
                    `${this._getStationEmoji(s)} ${s.displayName}`
                ).join('\n')
            });
        } else {
            embed.addFields({
                name: 'Sin estaciones',
                value: 'No hay estaciones que coincidan con los filtros seleccionados'
            });
        }

        // Add pagination footer if needed
        if (stations.length > this.stationsPerPage) {
            embed.setFooter({ 
                text: `Página ${cacheData.currentPage + 1}/${totalPages} • ` +
                      `${stations.length} estaciones en total`
            });
        }

        return embed;
    }

    /**
     * Creates the interactive button components
     */
    _createExpresoComponents(lineValue, cacheData) {
        const components = [];
        const stations = this._getCurrentStations(cacheData);
        const totalPages = Math.ceil(stations.length / this.stationsPerPage);
        
        // Route selection buttons
        const routeTypeRow = new ActionRowBuilder();
        Object.entries(this.routeTypes).forEach(([type, config]) => {
            const isActive = cacheData.activeRoutes.includes(type);
            const isDisabled = !isActive && 
                            !config.exclusive && 
                            cacheData.activeRoutes.length >= this.maxRouteCombinations;
            
            routeTypeRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`expreso:${lineValue}:${type}`)
                    .setLabel(config.label)
                    .setEmoji(config.emoji)
                    .setStyle(isActive ? ButtonStyle.Primary : config.style)
                    .setDisabled(isDisabled)
            );
        });
        components.push(routeTypeRow);

        // Pagination controls (only if needed)
        if (stations.length > this.stationsPerPage) {
            const paginationRow = new ActionRowBuilder();
            
            paginationRow.addComponents(
                // Previous page button
                new ButtonBuilder()
                    .setCustomId(`expreso:${lineValue}:page:prev`)
                    .setLabel('◀️ Anterior')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(cacheData.currentPage === 0),
                
                // Current page indicator
                new ButtonBuilder()
                    .setCustomId(`expreso:${lineValue}:refresh`)
                    .setLabel(`Página ${cacheData.currentPage + 1}/${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                
                // Next page button
                new ButtonBuilder()
                    .setCustomId(`expreso:${lineValue}:page:next`)
                    .setLabel('Siguiente ▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(cacheData.currentPage >= totalPages - 1)
            );
            
            components.push(paginationRow);
        }

        return components;
    }

    /**
     * Helper: Gets display text for active routes
     */
    _getActiveRoutesDisplay(activeRoutes) {
        if (activeRoutes.includes('todas')) {
            return `${this.routeTypes.todas.emoji} Todas las rutas`;
        }
        return activeRoutes
            .map(r => `${this.routeTypes[r].emoji} ${this.routeTypes[r].label}`)
            .join(' + ');
    }

    /**
     * Helper: Gets combined descriptions for active routes
     */
    _getRouteDescriptions(activeRoutes) {
        if (activeRoutes.includes('todas')) {
            return this.routeTypes.todas.description;
        }
        return activeRoutes
            .map(r => this.routeTypes[r].description)
            .join(' • ');
    }

    /**
     * Helper: Gets the appropriate emoji for a station
     */
    _getStationEmoji(station) {
        if (!station.ruta) return config.stationIcons.comun.emoji;
        const routeType = station.ruta.toLowerCase().replace('ruta ', '');
        return config.stationIcons[routeType]?.emoji || config.stationIcons.comun.emoji;
    }

    /**
     * Helper: Calculates new page number
     */
    _calculateNewPage(action, currentPage, totalStations) {
        const totalPages = Math.ceil(totalStations / this.stationsPerPage);
        switch (action) {
            case 'prev': return Math.max(0, currentPage - 1);
            case 'next': return Math.min(totalPages - 1, currentPage + 1);
            default: return currentPage;
        }
    }

    /**
     * Helper: Generates cache key
     */
    _getCacheKey(lineValue) {
        return `expreso_${lineValue}`;
    }

    /**
     * Handles expired data scenario
     */
    async _handleExpiredData(interaction) {
        const response = {
            content: '⚠️ Los datos de la línea han expirado. Por favor usa el comando nuevamente.',
            ephemeral: true
        };

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(response);
        } else {
            await interaction.reply(response);
        }
    }

    /**
     * Handles general errors
     */
    async _handleError(interaction) {
        const response = {
            content: '❌ Error al procesar la solicitud de rutas expresas. Por favor intenta nuevamente.',
            ephemeral: true
        };

        if (interaction.deferred || interaction.replied) {
            await interaction.followUp(response);
        } else {
            await interaction.reply(response);
        }
    }
}

module.exports = ExpresoButton;