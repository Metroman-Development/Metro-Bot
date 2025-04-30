const { EmbedBuilder } = require('discord.js');
const { getCache, deleteCache, setCache } = require('../../../utils/cache');
const { createRouteEmbed, createRouteButtons } = require('../../../config/defaultEmbeds/expressRouteInfo');
const { resolveRouteCombination, getStationsByRoute } = require('../../../utils/expressRoutes');

const TIMEOUT = 300000; // 5 minutes

module.exports = [
    {
        customId: 'route_type_',
        async execute(interaction) {
            await handleRouteInteraction(interaction, 'type');
        }
    },
    {
        customId: 'route_pagination_',
        async execute(interaction) {
            await handleRouteInteraction(interaction, 'pagination');
        }
    }
];

async function handleRouteInteraction(interaction, actionType) {
    try {
        const [_, __, action, lineKey, currentPage, userId, embedId] = interaction.customId.split('_');
        const cached = getCache(userId, embedId);

        if (!cached) {
            return interaction.followUp({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('⚠️ Sesión Expirada')
                        .setDescription('Ejecuta /ruta nuevamente')
                ],
                ephemeral: true
            });
        }

        let newPage = parseInt(currentPage) || 0;
        let newRoute = cached.route;
        let stations = cached.stations;

        switch(actionType) {
            case 'type':
                newRoute = resolveRouteCombination(action, cached.route);
                newPage = 0;
                stations = getStationsByRoute(lineKey, newRoute);
                break;
            case 'pagination':
                newPage = action === 'next' ? newPage + 1 : Math.max(0, newPage - 1);
                break;
        }

        const updatedCache = {
            ...cached,
            currentPage: newPage,
            route: newRoute,
            stations: stations
        };

        const totalPages = Math.ceil(stations.length / 10);
        const embed = createRouteEmbed(
            lineKey,
            newRoute,
            stations,
            newPage,
            totalPages,
            interaction
        );
        
        const buttons = createRouteButtons(
            lineKey,
            newRoute,
            newPage,
            totalPages,
            userId,
            embedId
        );

        await interaction.editReply({ embeds: [embed], components: buttons });

        clearTimeout(updatedCache.timeout);
        updatedCache.timeout = setTimeout(() => {
            deleteCache(userId, embedId);
            interaction.editReply({ components: [] }).catch(() => {});
        }, TIMEOUT);

        setCache(userId, embedId, updatedCache);

    } catch (error) {
        console.error(`Error en handler de ruta (${actionType}):`, error);
        await interaction[interaction.replied ? 'followUp' : 'reply']({
            content: '❌ Error al procesar la solicitud',
            ephemeral: true
        });
    }
}