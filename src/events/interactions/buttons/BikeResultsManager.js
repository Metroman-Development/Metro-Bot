const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const cacheManager = require('../../../utils/cacheManager');
const config = require('../../../config/metro/metroConfig');

const CUSTOM_ID_PREFIX = 'bikeResults';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const RESULTS_PER_PAGE = 10;

// --- Helper Functions ---

function _normalizeQuery(query) {
    return query.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function _getCacheKey(query, userId) {
    return `${CUSTOM_ID_PREFIX}:${userId}:${_normalizeQuery(query)}`;
}

function _createPaginationButtons(cacheData) {
    const { query, userId, currentPage, totalPages } = cacheData;
    if (totalPages <= 1) return null;

    const cacheKey = _getCacheKey(query, userId);

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${CUSTOM_ID_PREFIX}:prev:${cacheKey}`)
            .setLabel('◀')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === 1),
        new ButtonBuilder()
            .setCustomId(`${CUSTOM_ID_PREFIX}:page:${cacheKey}`)
            .setLabel(`${currentPage}/${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`${CUSTOM_ID_PREFIX}:next:${cacheKey}`)
            .setLabel('▶')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === totalPages)
    );
}

function _createResultsMessage(cacheData) {
    const { query, results, currentPage, totalPages } = cacheData;
    const startIdx = (currentPage - 1) * RESULTS_PER_PAGE;
    const endIdx = startIdx + RESULTS_PER_PAGE;
    const pageResults = results.slice(startIdx, endIdx);

    const embed = new EmbedBuilder()
        .setTitle(`🚴 Estaciones con bicicletas: ${query}`)
        .setColor('#00BFFF')
        .setFooter({ text: `Página ${currentPage}/${totalPages} • ${results.length} resultados encontrados` });

    const lineGroups = {};
    pageResults.forEach(station => {
        const lineKey = `${station.line}`;
        if (!lineGroups[lineKey]) lineGroups[lineKey] = [];
        lineGroups[lineKey].push(`👉 **${station.name.replace(/\bl[1-9]a?\b\s*/gi, "")}**`);
    });

    Object.entries(lineGroups).forEach(([line, stations]) => {
        const lineEmoji = config.linesEmojis[line.toLowerCase()] || `🚇`;
        embed.addFields({
            name: `${lineEmoji} Línea ${line.replace(/L/g, "")}`,
            value: stations.join('\n') || "No se encontraron bicicletas",
            inline: true
        });
    });

    if (pageResults.length === 0) {
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

function buildBikeReply(query, results, userId) {
    const cacheKey = _getCacheKey(query, userId);
    const totalPages = Math.ceil(results.length / RESULTS_PER_PAGE);

    const cacheData = {
        query,
        results,
        userId,
        currentPage: 1,
        totalPages,
    };

    cacheManager.set(cacheKey, cacheData, CACHE_DURATION);
    return _createResultsMessage(cacheData);
}

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
            return interaction.deferUpdate();
    }

    cacheManager.set(cacheKey, cacheData, CACHE_DURATION);

    try {
        const messagePayload = _createResultsMessage(cacheData);
        await interaction.update(messagePayload);
    } catch (error) {
        console.error(`[${CUSTOM_ID_PREFIX}] Error updating results:`, error);
    }
}

module.exports = {
    customIdPrefix: CUSTOM_ID_PREFIX,
    execute,
    buildBikeReply,
};
