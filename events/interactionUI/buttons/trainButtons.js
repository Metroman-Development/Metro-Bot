 const { EmbedBuilder } = require('discord.js');
const { getCache, deleteCache } = require('../../../utils/cache');
const { 
    createTrainOverview,
    createTechSpecsEmbed,
    createPerformanceEmbed
} = require('../../../config/defaultEmbeds/trainEmbeds');

const TIMEOUT = 300000; // 5 minutes

module.exports = [
    {
        customId: 'train_tech_',
        async execute(interaction) {
            handleButtonInteraction(interaction, createTechSpecsEmbed);
        }
    },
    {
        customId: 'train_perf_',
        async execute(interaction) {
            handleButtonInteraction(interaction, createPerformanceEmbed);
        }
    },
    {
        customId: 'train_main_',
        async execute(interaction) {
            handleButtonInteraction(interaction, createTrainOverview);
        }
    }
];

async function handleButtonInteraction(interaction, embedCreator) {
    try {
        const [,, userId, embedId] = interaction.customId.split('_');
        const cached = getCache(userId, embedId);
        
        if (!cached) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('⚠️ Sesión Expirada')
                        .setDescription('Ejecuta /tren nuevamente')
                ],
                ephemeral: true
            });
        }

        const { embed, buttons } = embedCreator(cached.data, cached.model, `${userId}_${embedId}`);
        await interaction.editReply({ embeds: [embed], components: buttons });

        setTimeout(() => {
            deleteCache(userId, embedId);
            interaction.editReply({ components: [] }).catch(() => {});
        }, TIMEOUT);

    } catch (error) {
        console.error(`Error in ${interaction.customId} handler:`, error);
        await interaction[interaction.replied ? 'followUp' : 'reply']({
            content: '❌ Error al procesar la solicitud',
            ephemeral: true
        });
    }
}