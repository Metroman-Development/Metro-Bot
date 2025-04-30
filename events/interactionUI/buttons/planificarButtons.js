const { EmbedBuilder } = require('discord.js');
const { getCache, deleteCache } = require('../../../utils/cache');
const { createRouteEmbed, createSummaryEmbed, BUTTONS } = require('../../../config/defaultEmbeds/planificarEmbed');

const TIMEOUT = 600000; // 10 minutes

module.exports = [
    {
        customId: 'planificar_summary',
        async execute(interaction) {
            await handleButtonInteraction(interaction, 'summary');
        }
    },
    {
        customId: 'planificar_fastest',
        async execute(interaction) {
            await handleButtonInteraction(interaction, 'fastest');
        }
    },
    {
        customId: 'planificar_balanced',
        async execute(interaction) {
            await handleButtonInteraction(interaction, 'balanced');
        }
    },
    {
        customId: 'planificar_slowest',
        async execute(interaction) {
            await handleButtonInteraction(interaction, 'slowest');
        }
    }
];

async function handleButtonInteraction(interaction, actionType) {
    try {
        const [prefix, action, userId, messageId] = interaction.customId.split('_');
        
        console.log(interaction.customId);
        const cachedData = getCache(userId, messageId);

        if (!cachedData) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('⚠️ Sesión Expirada')
                        .setDescription('Ejecuta /planificar nuevamente')
                ],
                ephemeral: true
            });
        }

        let response;
        switch(actionType) {
            case 'summary':
                response = createSummaryEmbed(cachedData.routes, cachedData.startDetails, cachedData.endDetails, cachedData.farePeriod);
                break;
            default:
                const routeIndex = { fastest: 0, balanced: 1, slowest: 2 }[actionType];
                response = createRouteEmbed(cachedData.routes[routeIndex], cachedData.startDetails, cachedData.endDetails, cachedData.farePeriod);
        }

        await interaction.editReply({ 
       
            embeds: [response.embed],
            components: [response.buttons(userId, messageId)]
        });

        // Refresh timeout
        clearTimeout(cachedData.timeout);
        cachedData.timeout = setTimeout(() => {
            deleteCache(userId, messageId);
        }, TIMEOUT);

    } catch (error) {
        console.error(`Error en botón ${actionType}:`, error);
        await interaction[interaction.replied ? 'followUp' : 'reply']({
            content: '❌ Error al procesar la solicitud',
            ephemeral: true
        });
    }
}