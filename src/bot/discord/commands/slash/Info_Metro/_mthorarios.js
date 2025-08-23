const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const chronosConfig = require('../../../../../config/chronosConfig');
const metroConfig = require('../../../../../config/metro/metroConfig');
const TimeHelpers = require('../../../../../utils/timeHelpers.js');

module.exports = {
    parentCommand: "tarifa",
    data: (subcommand) => subcommand
        .setName('horarios')
        .setDescription('Muestra los horarios de los períodos tarifarios'),

    async execute(interaction) {
        try {
            await interaction.deferReply();
            
            const currentPeriod = TimeHelpers.getCurrentPeriod();
            
            const periodDefinitions = {
                'PUNTA': {
                    emoji: '🚨',
                    name: 'Hora Punta'
                },
                'VALLE': {
                    emoji: '🟢',
                    name: 'Horario Normal'
                },
                'BAJO': {
                    emoji: '🔵',
                    name: 'Horario Bajo'
                },
                'NOCHE': {
                    emoji: '🌙',
                    name: 'Horario Nocturno'
                }
            };

            const formatTime = (timeStr) => {
                // Normalize time format (6:00:00 -> 06:00)
                const parts = timeStr.split(':');
                if (parts[0].length === 1) parts[0] = '0' + parts[0];
                return parts.slice(0, 2).join(':'); // Remove seconds
            };

            const formatPeriods = (periodType) => {
                const periods = chronosConfig.farePeriods[periodType] || [];
                return periods.map(p => {
                    return `**${formatTime(p.start)} - ${formatTime(p.end)}**`;
                }).join('\n') || 'No definido';
            };

            const embed = new EmbedBuilder()
                .setTitle('⏰ Horarios de Períodos Tarifarios')
                .setColor(0xFFD700)
                .setThumbnail(metroConfig.metroLogo.v4);

            // Add period fields
            Object.entries(periodDefinitions).forEach(([periodType, {emoji, name}]) => {
                embed.addFields({
                    name: `${emoji} ${name} (${periodType}) ${currentPeriod.type === periodType ? '🟢 ACTUAL' : ''}`,
                    value: formatPeriods(periodType),
                    inline: true
                });
            });

            // Add service hours
            embed.addFields({
                name: '🕒 Horario de Servicio',
                value: formatPeriods('SERVICEHOURS'),
                inline: false
            });

            embed.setFooter({ 
                text: 'Horarios sujetos a cambios por eventos especiales', 
                iconURL: metroConfig.metroLogo.principal 
            });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error en /tarifa horarios:', error);
            await interaction.editReply({
                content: '❌ Error al obtener los horarios tarifarios',
                ephemeral: true
            });
        }
    }
};