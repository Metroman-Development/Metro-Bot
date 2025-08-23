const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const TimeHelpers = require('../../../../../utils/timeHelpers');
const metroConfig = require('../../../../../config/metro/metroConfig');

module.exports = {
    parentCommand: 'servicio-metro',
    data: (subcommand) => subcommand
        .setName('periodo')
        .setDescription('Período operacional actual y tarifas vigentes'),

    async execute(interaction) {
        try {
            await interaction.deferReply();
            
            // Get current period and operating info
            const period = TimeHelpers.getCurrentPeriod();
            const hours = TimeHelpers.getOperatingHours();
            
            // Spanish day names mapping
            const spanishDays = {
                'weekday': 'Día hábil',
                'saturday': 'Sábado',
                'sunday': 'Domingo',
                'festive': 'Feriado'
            };
            const dayType = spanishDays[TimeHelpers.getDayType()] || 'Día hábil';
            
            // Get current fare based on period
            const fareKey = `t_metro_${period.type.toLowerCase()}`;
            const currentFare = metroConfig.tarifario[fareKey] || '790'; // Default to VALLE
            
            // Prepare emoji and color mapping with requested scheme
            const periodConfig = {
                'PUNTA': { 
                    emoji: '🚨', 
                    color: 0xFFFF00, // Yellow
                    name: 'Hora Punta',
                    icon: '⏰' 
                },
                'VALLE': { 
                    emoji: '🟢', 
                    color: 0x00FF00, // Green
                    name: 'Horario Normal',
                    icon: '🟢' 
                },
                'BAJO': { 
                    emoji: '🔵', 
                    color: 0x0000FF, // Blue
                    name: 'Horario Bajo',
                    icon: '🔷' 
                },
                'NOCHE': { 
                    emoji: '🌙', 
                    color: 0x000080, // Dark Blue
                    name: 'Fuera de Servicio',
                    icon: '🌃' 
                }
            };
            
            const currentPeriod = periodConfig[period.type] || periodConfig.VALLE;
            
            // Create embed
            const embed = new EmbedBuilder()
                .setTitle(`${currentPeriod.icon} ${currentPeriod.name} ${currentPeriod.emoji}`)
                .setColor(currentPeriod.color)
                .setThumbnail(metroConfig.metroLogo.principal)
                .addFields(
                    {
                        name: `${metroConfig.emoji.tren} Tipo de día`,
                        value: `**${dayType}**`,
                        inline: true
                    },
                    {
                        name: `${metroConfig.emoji.rendimiento} Horario`,
                        value: `**${hours.opening} - ${hours.closing}**`,
                        inline: true
                    },
                    {
                        name: `${metroConfig.emoji.años} Tarifa actual`,
                        value: `**$${currentFare}** CLP\n-# Sin contar las tarifas diferenciadas, revisa el árbol de comandos de \`/tarifa\` para más información`,
                        inline: true
                    },
                    {
                        name: `${metroConfig.emoji.tecnico} Líneas con Ruta Expresa`,
                        value: TimeHelpers.isExpressActive() ? 
                            `${metroConfig.expressLines.map(l => metroConfig.linesEmojis[l]).join(' ')} **ACTIVAS**` : 
                            'No activas',
                        inline: true
                    },
                    {
                        name: `${metroConfig.emoji.equipamiento} Próximo cambio`,
                        value: `**${TimeHelpers.getNextTransition().message}** a las ${TimeHelpers.getNextTransition().time}`,
                        inline: true
                    }
                )
                .setFooter({ 
                    text: 'Metro de Santiago • Estado operacional', 
                    iconURL: metroConfig.metroLogo.v4 
                })
                .setTimestamp();
            
            // Add extended hours notice if applicable
            if (hours.isExtended) {
                embed.addFields({
                    name: '⚠️ Horario extendido',
                    value: `Servicio extendido hasta **${hours.extension[1]}**\n${metroConfig.statusTypes['5'].emoji} ${metroConfig.statusTypes['5'].description}`,
                    inline: false
                });
            }
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error en /metro-estado periodo:', error);
            await interaction.editReply({
                content: '❌ Error al obtener información del período operacional',
                ephemeral: true
            });
        }
    }
};