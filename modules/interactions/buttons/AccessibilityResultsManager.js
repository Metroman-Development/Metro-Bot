const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const BaseButton = require('./templates/baseButton');
const interactionStore = require('../utils/interactionStore');
const config = require('../../../config/metro/metroConfig');
const styles = require('../../../config/metro/styles.json');

class AccessibilityResultsManager extends BaseButton {
    constructor() {
        super({
            customIdPrefix: 'accessibilityResults',
            style: ButtonStyle.Secondary
        });

        this._cachingInProgress = new Set();
        this.cacheDuration = 15 * 60 * 1000;
        this.resultsPerPage = 3;
    }

    async build(query, filters, results, userId) {
        const cacheKey = this._getCacheKey(query, userId);
        const totalPages = Math.ceil(results.length / this.resultsPerPage);

        const cacheData = {
            query,
            filters,
            results,
            userId,
            currentPage: 1,
            totalPages,
            timestamp: Date.now()
        };

        interactionStore.set(cacheKey, cacheData, this.cacheDuration);
        return this._createResultsMessage(cacheData);
    }

    _processAccessibilityData(station) {
        if (station.isNewFormat) {
            return this._formatNewAccessibilityData(station);
        }
        return this._processLegacyAccessibilityText(station.accessibility);
    }

    _formatNewAccessibilityData(station) {
        const accData = station.accessibility;
        const lines = [];

        // Format accesses
        if (accData.accesses.length > 0) {
            lines.push('**Accesos:**');
            accData.accesses.forEach(access => {
                let line = `- ${access.name}`;
                if (access.description) line += ` (${access.description})`;
                if (access.status) line += ` [${this._formatStatus(access.status)}]`;
                lines.push(line);
            });
        }

        // Format elevators
        if (accData.elevators.length > 0) {
            lines.push('\n**Ascensores:**');
            accData.elevators.forEach(elevator => {
                let line = `- ${elevator.id}: ${elevator.from} → ${elevator.to}`;
                if (elevator.status) line += ` [${this._formatStatus(elevator.status)}]`;
                lines.push(line);
            });
        }

        // Format escalators
        if (accData.escalators.length > 0) {
            lines.push('\n**Escaleras Mecánicas:**');
            accData.escalators.forEach(escalator => {
                let line = `- ${escalator.id}: ${escalator.from} → ${escalator.to}`;
                if (escalator.status) line += ` [${this._formatStatus(escalator.status)}]`;
                lines.push(line);
            });
        }

        return lines.join('\n');
    }

    _formatStatus(status) {
        const statusMap = {
            'operativo': '🟢 Operativo',
            'fuera de servicio': '🔴 Fuera de servicio',
            'en reparación': '🟡 En reparación',
            'limitado': '🟠 Limitado'
        };
        return statusMap[status.toLowerCase()] || status;
    }

    _processLegacyAccessibilityText(text) {
        if (!text) return 'No hay información de accesibilidad';
        
        return text.split('\n')
            .map(line => {
                let processedLine = line.trim();
                const lowerLine = processedLine.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                // Handle letter indicators
                processedLine = processedLine.replace(/\(([a-z])\)/gi, (match, letter) => {
                    const upperLetter = letter.toUpperCase();
                    return String.fromCodePoint(0x1F170 + upperLetter.charCodeAt(0) - 65) + (upperLetter > 'A' ? '' : '️');
                });

                // Add appropriate icons
                if (lowerLine.includes('escala mecánica') || lowerLine.includes('escalera mecánica')) {
                    return `${config.accessibility.escalera} ${processedLine}`;
                }
                
                if (lowerLine.includes('todos los ascensores disponibles') || 
                    lowerLine.match(/todos los ascensores (operativos|disponibles)/)) {
                    return `${config.accessibility.estado.ope} ${processedLine}`;
                }
                
                if (lowerLine.includes('fuera de servicio') || 
                    lowerLine.includes('no disponible') ||
                    lowerLine.includes('no operativo')) {
                    return `${config.accessibility.estado.fes} ${processedLine}`;
                }
                
                if (lowerLine.includes('salida de estación') || 
                    lowerLine.includes('a nivel de vereda') || 
                    lowerLine.includes('a nivel de calle')) {
                    return `${config.accessibility.salida} ${processedLine}`;
                }
            
                if (lowerLine.includes('ascensor') || lowerLine.includes('ascensores')) {
                    if (lowerLine.includes('al exterior') || lowerLine.includes('desde anden') || lowerLine.includes('desde andenes')) {
                        return `${config.accessibility.ascensor} ${processedLine}`;
                    }
                    return `${config.accessibility.ascensor} ${processedLine}`;
                }
                
                return `${processedLine}`;
            })
            .join('\n');
    }

    _createResultsMessage(cacheData) {
        const { query, filters, results, currentPage, totalPages } = cacheData;
        const startIdx = (currentPage - 1) * this.resultsPerPage;
        const endIdx = startIdx + this.resultsPerPage;
        const pageResults = results.slice(startIdx, endIdx);

        const embed = new EmbedBuilder()
            .setTitle(`${config.accessibility.logo} Estaciones con accesibilidad: ${query === 'Operativa' ? '🟢 Operativas' : '🔴 Con problemas'}`)
            .setColor(query === 'Operativa' ? '#2ECC71' : '#E74C3C')
            .setFooter({ 
                text: `Página ${currentPage}/${totalPages} • ${results.length} resultados encontrados`,
                iconURL: 'https://media.discordapp.net/attachments/792250794296606743/900913086343548958/unknown.png'
            });

        // Show applied filters
        if (filters.ascensor || filters.escaleraMecanica) {
            const filterParts = [];
            if (filters.ascensor) filterParts.push(`${config.accessibility.ascensor} Ascensores`);
            if (filters.escaleraMecanica) filterParts.push(`${config.accessibility.escalera} Escaleras Mecánicas`);
            
            embed.setDescription(`**Filtros aplicados:** ${filterParts.join(' • ')}`);
        }

        // Group stations by line
        const lineGroups = {};
        pageResults.forEach(station => {
            const lineKey = `${station.line}`;
            if (!lineGroups[lineKey]) lineGroups[lineKey] = [];
            
            const accessibilityInfo = this._processAccessibilityData(station);
            const stationName = this._cleanStationName(station.name);
            
            lineGroups[lineKey].push(
                `👉 **${stationName}**\n` +
                `${accessibilityInfo}`
            );
        });

        // Add fields for each line group
        Object.entries(lineGroups).forEach(([line, stations]) => {
            const lineKey = line.toLowerCase();
            const lineEmoji = config.linesEmojis[lineKey] || '🚇';
            const lineNumber = line.replace(/[^\d]/g, '');
            
            embed.addFields({
                name: `${lineEmoji} Línea ${lineNumber}`,
                value: stations.join('\n\n'),
                inline: true
            });
        });

        return {
            embeds: [embed],
            components: this._createPaginationButtons(cacheData)
        };
    }

    _cleanStationName(name) {
        return name.replace(/\bl[1-9]a?\b\s*/gi, "")
                   .replace("Línea", "")
                   .replace(/\s+/g, ' ')
                   .trim();
    }

    _createPaginationButtons(cacheData) {
        const { currentPage, totalPages, query, userId } = cacheData;
        
        if (totalPages <= 1) return [];

        const row = new ActionRowBuilder();

        // Previous Button
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`accessibilityResultsPrev:${this.customIdPrefix}:${query}:${userId}`)
                .setLabel('◀')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === 1)
        );

        // Page Counter
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`accessibilityResultsPage:${this.customIdPrefix}:${query}:${userId}:${currentPage}`)
                .setLabel(`${currentPage}/${totalPages}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );

        // Next Button
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`accessibilityResultsNext:${this.customIdPrefix}:${query}:${userId}`)
                .setLabel('▶')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === totalPages)
        );

        return [row];
    }

    async handleInteraction(interaction, metadata) {
        const [action, prefix, query, userId, page] = interaction.customId.split(':');
        const cacheKey = this._getCacheKey(query, userId);
        let cacheData = interactionStore.get(cacheKey);

        if (!cacheData) {
            return interaction.reply({
                content: 'Esta búsqueda ha expirado. Por favor realiza una nueva búsqueda.',
                ephemeral: true
            });
        }

        // Update page based on interaction
        switch(action) {
            case 'accessibilityResultsPrev':
                cacheData.currentPage = Math.max(1, cacheData.currentPage - 1);
                break;
            case 'accessibilityResultsNext':
                cacheData.currentPage = Math.min(cacheData.totalPages, cacheData.currentPage + 1);
                break;
            case 'accessibilityResultsPage':
                cacheData.currentPage = parseInt(page) || 1;
                break;
        }

        // Update cache
        interactionStore.set(cacheKey, {
            ...cacheData,
            timestamp: Date.now()
        }, this.cacheDuration);

        try {
            await interaction.editReply(this._createResultsMessage(cacheData));
        } catch (error) {
            console.error('Error updating accessibility results:', error);
            if ([10062, 10008].includes(error.code)) {
                await interaction.editReply({
                    content: 'This interaction expired. Please use the command again.',
                    ephemeral: true,
                    flags: 64
                });
            } else {
                await interaction.reply({
                    content: 'Ocurrió un error al actualizar los resultados.',
                    ephemeral: true
                });
            }
        }
    }

    _getCacheKey(query, userId) {
        return `accessibility_results:${userId}:${this._normalizeQuery(query)}`;
    }

    _normalizeQuery(query) {
        return query.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    }
}

module.exports = AccessibilityResultsManager;
