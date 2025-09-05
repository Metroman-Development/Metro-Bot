const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const cacheManager = require('../../../utils/cacheManager');
const metroConfig = require('../../../config/metro/metroConfig');
const { MetroInfoProvider } = require('../../../utils/MetroInfoProvider.js');

const CUSTOM_ID_PREFIX = 'expreso';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const STATIONS_PER_PAGE = 10;

// --- Helper Functions (from the old ExpresoButton class) ---

function getRouteTypes() {
    return {
        todas: { label: 'Todas', style: ButtonStyle.Primary, emoji: '🌐', exclusive: true },
        verde: { label: 'Verde', style: ButtonStyle.Success, emoji: metroConfig.routeStyles.verde.emoji, filter: (s) => s.ruta === 'Ruta Verde' },
        roja: { label: 'Roja', style: ButtonStyle.Danger, emoji: metroConfig.routeStyles.roja.emoji, filter: (s) => s.ruta === 'Ruta Roja' },
        comun: { label: 'Común', style: ButtonStyle.Secondary, emoji: metroConfig.routeStyles.comun.emoji, filter: (s) => !s.ruta || s.ruta === 'Común' },
    };
}

function getStationEmoji(station) {
    if (!station.ruta) return metroConfig.routeStyles.comun.emoji;
    const routeType = station.ruta.toLowerCase().replace('ruta ', '');
    return metroConfig.routeStyles[routeType]?.emoji || metroConfig.routeStyles.comun.emoji;
}

function getCurrentStations(cacheData) {
    if (cacheData.activeRoutes.includes('todas')) {
        return cacheData.allStations;
    }
    const combined = new Set();
    const routeTypes = getRouteTypes();
    for (const route of cacheData.activeRoutes) {
        cacheData.allStations.filter(routeTypes[route].filter).forEach(s => combined.add(s));
    }
    return Array.from(combined).sort((a, b) => a.order - b.order);
}

function createEmbed(cacheData) {
    const line = cacheData.line;
    const stations = getCurrentStations(cacheData);
    const totalPages = Math.ceil(stations.length / STATIONS_PER_PAGE);
    const paginatedStations = stations.slice(
        cacheData.currentPage * STATIONS_PER_PAGE,
        (cacheData.currentPage + 1) * STATIONS_PER_PAGE
    );
    const routeTypes = getRouteTypes();
    const activeRoutesText = cacheData.activeRoutes.map(r => `${routeTypes[r].emoji} ${routeTypes[r].label}`).join(' + ');

    const embed = new EmbedBuilder()
        .setTitle(`${metroConfig.linesEmojis[line.id] || '🚇'} ${line.displayName} - Rutas Expresas`)
        .setDescription(`**Rutas activas:** ${activeRoutesText}`)
        .setColor(line.color || '#0099ff');

    if (paginatedStations.length > 0) {
        embed.addFields({
            name: `Estaciones (${stations.length})`,
            value: paginatedStations.map(s => `${getStationEmoji(s)} ${s.displayName}`).join('\n')
        });
    } else {
        embed.addFields({ name: 'Sin estaciones', value: 'No hay estaciones que coincidan con los filtros.' });
    }

    if (stations.length > STATIONS_PER_PAGE) {
        embed.setFooter({ text: `Página ${cacheData.currentPage + 1}/${totalPages}` });
    }
    return embed;
}

function createComponents(cacheKey, cacheData) {
    const components = [];
    const routeTypes = getRouteTypes();
    const routeRow = new ActionRowBuilder();
    Object.entries(routeTypes).forEach(([type, config]) => {
        const isActive = cacheData.activeRoutes.includes(type);
        routeRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`${CUSTOM_ID_PREFIX}:route:${type}:${cacheKey}`)
                .setLabel(config.label)
                .setEmoji(config.emoji)
                .setStyle(isActive ? ButtonStyle.Primary : config.style)
        );
    });
    components.push(routeRow);

    const stations = getCurrentStations(cacheData);
    if (stations.length > STATIONS_PER_PAGE) {
        const totalPages = Math.ceil(stations.length / STATIONS_PER_PAGE);
        const paginationRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`${CUSTOM_ID_PREFIX}:page:prev:${cacheKey}`)
                .setLabel('◀️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(cacheData.currentPage === 0),
            new ButtonBuilder()
                .setCustomId(`${CUSTOM_ID_PREFIX}:page:indicator:${cacheKey}`)
                .setLabel(`${cacheData.currentPage + 1}/${totalPages}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`${CUSTOM_ID_PREFIX}:page:next:${cacheKey}`)
                .setLabel('▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(cacheData.currentPage >= totalPages - 1)
        );
        components.push(paginationRow);
    }
    return components;
}


// --- Exported Functions ---

async function build(interaction, metro) {
    const lineValue = interaction.options.getString('linea');
    const userId = interaction.user.id;
    const cacheKey = `${CUSTOM_ID_PREFIX}:${userId}:${interaction.id}`;

    const infoProvider = new MetroInfoProvider(metro);
    const line = infoProvider.getLineData(lineValue);
    const allStations = infoProvider.getStationsForLine(lineValue);

    const cacheData = {
        line: { id: lineValue, displayName: line.nombre, color: line.color },
        allStations,
        currentPage: 0,
        activeRoutes: ['todas'],
        userId,
    };
    cacheManager.set(cacheKey, cacheData, CACHE_DURATION);

    const embed = createEmbed(cacheData);
    const components = createComponents(cacheKey, cacheData);

    return { embeds: [embed], components };
}

async function execute(interaction) {
    const [_, type, action, cacheKey] = interaction.customId.split(':');
    let cacheData = cacheManager.get(cacheKey);

    if (!cacheData || cacheData.userId !== interaction.user.id) {
        return interaction.update({ content: 'Esta interacción ha expirado o no te pertenece.', embeds: [], components: [] }).catch(()=>{});
    }

    if (type === 'route') {
        const routeTypes = getRouteTypes();
        const selectedRoute = action;
        if (routeTypes[selectedRoute].exclusive) {
            cacheData.activeRoutes = [selectedRoute];
        } else {
            const index = cacheData.activeRoutes.indexOf(selectedRoute);
            if (index > -1) {
                cacheData.activeRoutes.splice(index, 1);
                if (cacheData.activeRoutes.length === 0) cacheData.activeRoutes = ['todas'];
            } else {
                if (cacheData.activeRoutes.includes('todas')) cacheData.activeRoutes = [];
                cacheData.activeRoutes.push(selectedRoute);
            }
        }
        cacheData.currentPage = 0;
    } else if (type === 'page') {
        const stations = getCurrentStations(cacheData);
        const totalPages = Math.ceil(stations.length / STATIONS_PER_PAGE);
        if (action === 'prev') cacheData.currentPage = Math.max(0, cacheData.currentPage - 1);
        if (action === 'next') cacheData.currentPage = Math.min(totalPages - 1, cacheData.currentPage + 1);
    }

    cacheManager.set(cacheKey, cacheData, CACHE_DURATION);

    const embed = createEmbed(cacheData);
    const components = createComponents(cacheKey, cacheData);

    await interaction.update({ embeds: [embed], components });
}

module.exports = {
    customIdPrefix: CUSTOM_ID_PREFIX,
    execute,
    build,
};
