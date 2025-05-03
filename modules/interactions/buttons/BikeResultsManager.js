// BikeResultsManager.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const BaseButton = require('./templates/baseButton');
const interactionStore = require('../utils/interactionStore');
const config = require('../../../config/metro/metroConfig');

class BikeResultsManager extends BaseButton {
    constructor() {
        super({
            customIdPrefix: 'bikeResults',
            style: ButtonStyle.Secondary
        });

        this.cacheDuration = 15 * 60 * 1000; // 15 minutes cache
        this.resultsPerPage = 10;
    }

    async build(query, results, userId) {
        const cacheKey = this._getCacheKey(query, userId);
        const totalPages = Math.ceil(results.length / this.resultsPerPage);

        const cacheData = {
            query,
            results,
            userId,
            currentPage: 1,
            totalPages,
            timestamp: Date.now()
        };

        interactionStore.set(cacheKey, cacheData, this.cacheDuration);
        return this._createResultsMessage(cacheData);
    }

    async handleInteraction(interaction, metadata) {
        const [action, _, query, userId, page] = interaction.customId.split(':');
        const cacheKey = this._getCacheKey(query, userId);
        const cacheData = interactionStore.get(cacheKey);

        if (!cacheData) {
            return interaction.reply({
                content: 'Esta búsqueda ha expirado. Por favor realiza una nueva búsqueda.',
                ephemeral: true
            });
        }

        // Update page based on button pressed
        switch(action) {
            case 'bikeResultsPrev':
                cacheData.currentPage = Math.max(1, cacheData.currentPage - 1);
                break;
            case 'bikeResultsNext':
                cacheData.currentPage = Math.min(cacheData.totalPages, cacheData.currentPage + 1);
                break;
            case 'bikeResultsPage':
                cacheData.currentPage = parseInt(page) || 1;
                break;
        }

        // Update cache
        cacheData.timestamp = Date.now();
        interactionStore.set(cacheKey, cacheData, this.cacheDuration);

        try {
            await interaction.editReply(this._createResultsMessage(cacheData));
        } catch (error) {
            console.error('Failed to update bike results:', error);
            await interaction.reply({
                content: 'Ocurrió un error al actualizar los resultados.',
                ephemeral: true
            });
        }
    }

    _createResultsMessage(cacheData) {
        const { query, results, currentPage, totalPages } = cacheData;
        const startIdx = (currentPage - 1) * this.resultsPerPage;
        const endIdx = startIdx + this.resultsPerPage;
        const pageResults = results.slice(startIdx, endIdx);

        // Create embed with bike theme
        const embed = new EmbedBuilder()
            .setTitle(`🚴 Estaciones con bicicletas: ${query}`)
            .setColor('#00BFFF') // Bike-like blue color
            .setFooter({ 
                text: `Página ${currentPage}/${totalPages} • ${results.length} resultados encontrados` 
            });

        // Group results by line for current page
        const lineGroups = {};
        pageResults.forEach(station => {
            const lineKey = `${station.line}`;
            if (!lineGroups[lineKey]) lineGroups[lineKey] = [];
            
            //console.log(station) 
            lineGroups[lineKey].push(
                `👉 **${station.name.replace(/\bl[1-9]a?\b\s*/gi, "")}**\n` 
              /*  `→ 🚲 ${station.connections?.bikes?.join(", ") || "Ninguna"}`*/
            );
        });

        // Add fields for each line group with line emojis
        Object.entries(lineGroups).forEach(([line, stations]) => {
            const lineEmoji = config.linesEmojis[line.toLowerCase()] || `🚇`;
            embed.addFields({
                name: `${lineEmoji} Línea ${line.replace(/L/g, "")}`,
                value: stations.join('\n') || "No se encontraron bicicletas",
                inline: true
            });
        });

        // Create pagination buttons if needed
        const components = this._createPaginationButtons(cacheData);

        return {
            embeds: [embed],
            components: components
        };
    }

    _createPaginationButtons(cacheData) {
        const { currentPage, totalPages, query, userId } = cacheData;
        
        if (totalPages <= 1) {
            return []; // No pagination needed for single page
        }

        const row = new ActionRowBuilder();

        // Previous Button
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`bikeResultsPrev:${this.customIdPrefix}:${query}:${userId}`)
                .setLabel('◀')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === 1)
        );

        // Page Counter (disabled button)
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('bikeResultsPageCount')
                .setLabel(`${currentPage}/${totalPages}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );

        // Next Button
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`bikeResultsNext:${this.customIdPrefix}:${query}:${userId}`)
                .setLabel('▶')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === totalPages)
        );

        return [row];
    }

    _getCacheKey(query, userId) {
        return `bike_results:${userId}:${this.normalizeQuery(query)}`;
    }

    normalizeQuery(query) {
        return query.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
}

module.exports = BikeResultsManager;