const { EmbedBuilder } = require('discord.js');
const PaginationTemplate = require('../templates/pagination');
const metroConfig = require('../../../config/metro/metroConfig');

const RESULTS_PER_PAGE = 5;

// --- Helper Functions ---

function _buildCommerceEmbed({ items, currentPage, totalPages, query }) {
    const embed = new EmbedBuilder()
        .setTitle(`🛍️ Estaciones con comercio: ${query}`)
        .setColor('#FF6B00')
        .setFooter({ text: `Página ${currentPage + 1}/${totalPages} • ${items.length * totalPages} resultados encontrados` });

    const lineGroups = {};
    items.forEach(station => {
        const lineKey = station.line;
        if (!lineGroups[lineKey]) lineGroups[lineKey] = [];

        const matchedItems = station.matching.map(item => {
            const emoji = metroConfig.commerce[item] || '▪️';
            return `${emoji} ${item}`;
        });

        lineGroups[lineKey].push(
            `👉 **${station.name.replace(/\bl[1-9]a?\b\s*/gi, "")}**\n` +
            `→ ${matchedItems.join(', ')}`
        );
    });

    Object.entries(lineGroups).forEach(([line, stations]) => {
        const lineEmoji = metroConfig.linesEmojis[line.toLowerCase()] || `🚇`;
        embed.addFields({
            name: `${lineEmoji} Línea ${line.replace(/L/g, "")}`,
            value: stations.join('\n') || "No se encontraron comercios",
            inline: true
        });
    });

    if (Object.keys(lineGroups).length === 0) {
        embed.setDescription('No se encontraron más resultados en esta página.');
    }

    return embed;
}

// --- Pagination Template Implementation ---

module.exports = PaginationTemplate.create({
    idPrefix: 'commerceResults',

    async fetchData(page, interaction, context) {
        const { results } = context;
        const totalPages = Math.ceil(results.length / RESULTS_PER_PAGE);
        const start = page * RESULTS_PER_PAGE;
        const end = start + RESULTS_PER_PAGE;
        return { items: results.slice(start, end), totalPages };
    },

    buildEmbed: ({ items, currentPage, totalPages }, interaction, context) => {
        const { query } = context;
        return _buildCommerceEmbed({ items, currentPage, totalPages, query });
    }
});
