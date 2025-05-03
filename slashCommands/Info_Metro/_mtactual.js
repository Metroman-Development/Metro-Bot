const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const metroConfig = require('../../config/metro/metroConfig');
const chronosConfig = require('../../config/chronosConfig');
const TimeHelpers = require('../../modules/chronos/timeHelpers');

module.exports = {
    parentCommand: 'tarifa',
    data: (subcommand) => subcommand
        .setName('actual')
        .setDescription('Muestra la tarifa actual según el período'),

    async execute(interaction) {
        try {
            await interaction.deferReply();
            
            const currentPeriod = TimeHelpers.getCurrentPeriod();
            const nextTransition = TimeHelpers.getNextTransition();
            
            // Get all relevant fares with proper emoji assignments
            const fares = {
                'Normal (BIP)': {
                    amount: metroConfig.tarifario[`t_metro_${currentPeriod.type.toLowerCase()}`],
                    emoji: metroConfig.accessCards.bip
                },
                'Estudiante (TNE)': {
                    amount: metroConfig.tarifario[`t_estudiante_${currentPeriod.type.toLowerCase()}`],
                    emoji: metroConfig.accessCards.tne
                },
                'Adulto Mayor': {
                    amount: metroConfig.tarifario[`t_adulto_${currentPeriod.type.toLowerCase()}`],
                    emoji: metroConfig.accessCards.tarjetaAdultoMayor
                },
                'BIP Adulto Mayor': {
                    amount: metroConfig.tarifario[`t_adultobip_${currentPeriod.type.toLowerCase()}`],
                    emoji: metroConfig.accessCards.bipAdultoMayor
                },
                'NOS': {
                    amount: metroConfig.tarifario[`t_nos_${currentPeriod.type.toLowerCase()}`],
                    emoji: '🟢'
                },
                'Red': {
                    amount: metroConfig.tarifario['t_transantiago'],
                    emoji: '🚌'
                }
            };

            const embed = new EmbedBuilder()
                .setTitle('💰 Tarifas Actuales')
                .setColor(0xFFD700)
                .setThumbnail(metroConfig.metroLogo.v4)
                .addFields(
                    {
                        name: 'Período Actual',
                        value: `**${currentPeriod.name}** (${TimeHelpers.formatForEmbed()})`,
                        inline: false
                    },
                    {
                        name: 'Próximo Cambio',
                        value: `**${nextTransition.time}**\n${nextTransition.message}`,
                        inline: false
                    },
                    ...Object.entries(fares).filter(([_, data]) => data.amount).map(([name, data]) => ({
                        name: `${data.emoji} ${name}`,
                        value: `**$${data.amount}**`,
                        inline: true
                    }))
                )
                .setFooter({ 
                    text: 'Tarifas sujetas a cambios', 
                    iconURL: metroConfig.metroLogo.principal 
                });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error en /tarifa actual:', error);
            await interaction.editReply({
                content: '❌ Error al obtener la tarifa actual',
                ephemeral: true
            });
        }
    }
};