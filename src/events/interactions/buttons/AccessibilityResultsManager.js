const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const cacheManager = require('../../../utils/cacheManager');
const config = require('../../../config/metro/metroConfig');
const styles = {};

const CUSTOM_ID_PREFIX = 'accResults';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const MAX_FIELD_LENGTH = 1024;
const MAX_STATIONS_PER_PAGE = 3;
const MAX_CONTENT_PER_PAGE = 6000;

// --- Helper Functions (previously private methods in the class) ---

function _normalizeQuery(query) {
    return query.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

function _getCacheKey(query, userId) {
    return `${CUSTOM_ID_PREFIX}:${userId}:${_normalizeQuery(query)}`;
}

function _formatStatus(status) {
    const statusMap = {
        'operativo': '🟢 Operativo',
        'fuera de servicio': '🔴 Fuera de servicio',
        'en reparación': '🟡 En reparación',
        'limitado': '🟠 Limitado'
    };
    return statusMap[status.toLowerCase()] || status;
}

function _matchesStatusFilter(actualStatus, filterStatus) {
    const normalizedActual = actualStatus.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const normalizedFilter = filterStatus.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return normalizedActual.includes(normalizedFilter);
}

function _getStatusFilter(filters) {
    if (filters.operativo && !filters.fueraDeServicio) return 'operativa';
    if (filters.fueraDeServicio && !filters.operativo) return 'fuera de servicio';
    return null;
}

function _formatNewAccessibilityData(station, filters = {}) {
    const accData = station.accessDetails;
    const lines = [];
    const statusFilter = _getStatusFilter(filters);
    const hasEquipmentFilter = filters.ascensor || filters.escaleraMecanica;

    if (accData.accesses.length > 0 && !statusFilter && !hasEquipmentFilter) {
        lines.push('***Accesos:***');
        accData.accesses.forEach(access => {
            lines.push(`- ${access.name}${access.description ? ` (${access.description})` : ''}`);
        });
    }

    if ((filters.ascensor || !hasEquipmentFilter) && accData.elevators.length > 0) {
        const filtered = accData.elevators.filter(e => !statusFilter || (e.status && _matchesStatusFilter(e.status, statusFilter)));
        if (filtered.length > 0) {
            lines.push('***Ascensores:***');
            filtered.forEach(e => lines.push(`- ${e.id}: Desde ${e.from} hacia ${e.to}${e.status ? ` [${_formatStatus(e.status)}]` : ''}`));
        }
    }

    if ((filters.escaleraMecanica || !hasEquipmentFilter) && accData.escalators.length > 0) {
        const filtered = accData.escalators.filter(e => !statusFilter || (e.status && _matchesStatusFilter(e.status, statusFilter)));
        if (filtered.length > 0) {
            lines.push('***Escaleras Mecánicas:***');
            filtered.forEach(e => lines.push(`- ${e.id}: Desde ${e.from} hacia ${e.to}${e.status ? ` [${_formatStatus(e.status)}]` : ''}`));
        }
    }

    return lines.length > 0 ? lines.join('\n') : 'No hay equipos que coincidan con los filtros aplicados';
}

function _processLegacyAccessibilityText(text, filters = {}) {
    if (!text) return 'No hay información de accesibilidad';
    const statusFilter = _getStatusFilter(filters);
    return text.split('\n').map(line => line.trim()).filter(Boolean).join('\n'); // Simplified for now
}

function _processAccessibilityData(station, filters = {}) {
    if (station.isNewFormat) {
        return _formatNewAccessibilityData(station.stationData, filters);
    }
    return _processLegacyAccessibilityText(station.accessibility, filters);
}

function _cleanStationName(name) {
    return name.replace(/\bl[1-9]a?\b\s*/gi, "").replace("Línea", "").replace(/\s+/g, ' ').trim();
}

function _splitLongAccessibilityText(text) {
    if (!text || text.length <= MAX_FIELD_LENGTH) return [text];
    const parts = [];
    let currentPart = '';
    text.split('\n\n').forEach(p => {
        if (currentPart.length + p.length > MAX_FIELD_LENGTH) {
            parts.push(currentPart);
            currentPart = p + '\n\n';
        } else {
            currentPart += p + '\n\n';
        }
    });
    if (currentPart) parts.push(currentPart.trim());
    return parts;
}

function _calculatePagination(results) {
    const plan = [];
    let currentPage = [];
    let currentPageLength = 0;
    for (const station of results) {
        const stationLength = station.processedName.length + station.parts.reduce((sum, part) => sum + part.length, 0);
        if (currentPage.length > 0 && (currentPageLength + stationLength > MAX_CONTENT_PER_PAGE || currentPage.length >= MAX_STATIONS_PER_PAGE)) {
            plan.push([...currentPage]);
            currentPage = [];
            currentPageLength = 0;
        }
        station.totalParts = station.parts.length;
        currentPage.push(station);
        currentPageLength += stationLength;
    }
    if (currentPage.length > 0) plan.push(currentPage);
    return plan;
}

function _createPaginationButtons(cacheData) {
    const { currentPage, totalPages, query, userId } = cacheData;
    if (totalPages <= 1) return null;

    const cacheKey = _getCacheKey(query, userId);

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${CUSTOM_ID_PREFIX}:prev:${cacheKey}`)
            .setLabel('◀ Anterior')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === 1),
        new ButtonBuilder()
            .setCustomId(`${CUSTOM_ID_PREFIX}:page:${cacheKey}`)
            .setLabel(`${currentPage}/${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`${CUSTOM_ID_PREFIX}:next:${cacheKey}`)
            .setLabel('Siguiente ▶')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === totalPages)
    );
}

function _createResultsMessage(cacheData) {
    const { query, filters, paginationPlan, currentPage, totalPages, processedResults } = cacheData;
    const pageStations = paginationPlan[currentPage - 1] || [];

    const embed = new EmbedBuilder()
        .setTitle(`${config.accessibility.logo} Estaciones con accesibilidad: ${query === 'Operativa' ? '🟢 Operativas' : '🔴 Con problemas'}`)
        .setColor(query === 'Operativa' ? '#2ECC71' : '#E74C3C')
        .setFooter({
            text: `Página ${currentPage}/${totalPages} • ${processedResults.length} estaciones encontradas`,
            iconURL: 'https://media.discordapp.net/attachments/792250794296606743/900913086343548958/unknown.png'
        });

    if (filters.ascensor || filters.escaleraMecanica || filters.operativo || filters.fueraDeServicio) {
        const filterParts = [];
        if (filters.ascensor) filterParts.push(`${config.accessibility.ascensor} Ascensores`);
        if (filters.escaleraMecanica) filterParts.push(`${config.accessibility.escalera} Escaleras Mecánicas`);
        if (filters.operativo) filterParts.push(`🟢 Operativos`);
        if (filters.fueraDeServicio) filterParts.push(`🔴 Fuera de servicio`);
        embed.setDescription(`**Filtros aplicados:** ${filterParts.join(' • ')}`);
    }

    pageStations.forEach(station => {
        embed.addFields({
            name: `${config.linesEmojis[station.line.toLowerCase()] || '🚇'} ${station.processedName}`,
            value: station.processedAccessibility || 'No hay información.',
            inline: false
        });
    });

    if (pageStations.length === 0) {
        embed.setDescription('No se encontraron estaciones para esta página.');
    }

    const components = [];
    const paginationRow = _createPaginationButtons(cacheData);
    if (paginationRow) {
        components.push(paginationRow);
    }

    return { embeds: [embed], components, ephemeral: false };
}


// --- Exported Functions ---

/**
 * Builds the initial response for the accessibility command.
 * It processes the results, stores them in the cache, and returns the message payload.
 */
function buildAccessibilityReply(query, filters, results, userId) {
    const cacheKey = _getCacheKey(query, userId);

    const processedResults = results.map(station => ({
        ...station,
        processedName: _cleanStationName(station.name),
        processedAccessibility: _processAccessibilityData(station, filters),
        parts: _splitLongAccessibilityText(_processAccessibilityData(station, filters)),
    }));

    const paginationPlan = _calculatePagination(processedResults);
    const totalPages = paginationPlan.length;

    const cacheData = { query, filters, processedResults, userId, currentPage: 1, totalPages, paginationPlan };
    cacheManager.set(cacheKey, cacheData, CACHE_DURATION);

    return _createResultsMessage(cacheData);
}

/**
 * The main execution function for handling button interactions for accessibility results.
 */
async function execute(interaction) {
    const [_, action, cacheKey] = interaction.customId.split(':');
    let cacheData = cacheManager.get(cacheKey);

    if (!cacheData) {
        return interaction.update({
            content: 'Esta búsqueda ha expirado. Por favor, realiza una nueva búsqueda.',
            embeds: [],
            components: [],
        }).catch(err => console.error("Error updating expired interaction:", err));
    }

    if (interaction.user.id !== cacheData.userId) {
        return interaction.reply({ content: 'No puedes controlar los resultados de búsqueda de otra persona.', ephemeral: true });
    }

    switch(action) {
        case 'prev':
            cacheData.currentPage = Math.max(1, cacheData.currentPage - 1);
            break;
        case 'next':
            cacheData.currentPage = Math.min(cacheData.totalPages, cacheData.currentPage + 1);
            break;
        case 'page':
            // This button is disabled, but we handle it just in case.
            return interaction.deferUpdate();
    }

    cacheManager.set(cacheKey, cacheData, CACHE_DURATION);

    try {
        const messagePayload = _createResultsMessage(cacheData);
        await interaction.update(messagePayload);
    } catch (error) {
        console.error(`[${CUSTOM_ID_PREFIX}] Error updating results:`, error);
        if (error.code === 10062) { // Unknown interaction
            // The message was likely deleted, nothing we can do.
        } else {
            // Try to notify the user of the failure.
            interaction.followUp({ content: 'Ocurrió un error al actualizar los resultados.', ephemeral: true }).catch(e => {});
        }
    }
}

module.exports = {
    customIdPrefix: CUSTOM_ID_PREFIX,
    execute,
    buildAccessibilityReply,
};
