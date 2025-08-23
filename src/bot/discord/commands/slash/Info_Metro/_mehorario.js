const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const TimeHelpers = require('../../../../../utils/timeHelpers');
const metroConfig = require('../../../../../config/metro/metroConfig');

module.exports = {
    parentCommand: 'calendario-metro',
    data: (subcommand) => subcommand
        .setName('horario')
        .setDescription('Muestra los horarios regulares del Metro'),

    async execute(interaction) {
        try {
            await interaction.deferReply();
            
            // Get schedule information
            const serviceHours = metroConfig.horario;
            const currentHours = TimeHelpers.getOperatingHours();
            
            // Create main schedule embed
            const scheduleEmbed = new EmbedBuilder()
                .setTitle('⏰ Horarios Regulares del Metro')
                .setColor(0x0099FF)
                .setThumbnail(metroConfig.metroLogo.principal)
                .addFields(
                    {
                        name: '🚆 Días Hábiles (L-V)',
                        value: `**${serviceHours.Semana[0]} - ${serviceHours.Semana[1]}**`,
                        inline: true
                    },
                    {
                        name: '🟢 Sábados',
                        value: `**${serviceHours.Sábado[0]} - ${serviceHours.Sábado[1]}**`,
                        inline: true
                    },
                    {
                        name: '🔵 Domingos/Feriados',
                        value: `**${serviceHours.Domingo[0]} - ${serviceHours.Domingo[1]}**`,
                        inline: true
                    }
                )
                .setFooter({ 
                    text: 'Horarios sujetos a cambios por eventos especiales', 
                    iconURL: metroConfig.metroLogo.v4 
                });

            // Check for extended hours
            if (currentHours.isExtended) {
                const event = TimeHelpers.getEventDetails();
                scheduleEmbed.addFields({
                    name: '⚠️ Horario Extendido Hoy',
                    value: `**Cierre extendido hasta:** ${event?.endTime || currentHours.extension[1]}\n` +
                           `*${event?.name || 'Evento especial'}*`,
                    inline: false
                });
            }

            // Add express hours information
            if (TimeHelpers.isWeekday()) {
                scheduleEmbed.addFields({
                    name: '🚄 Horario Expreso (L-V)',
                    value: `**Mañana:** ${metroConfig.horarioExpreso.morning[0]} - ${metroConfig.horarioExpreso.morning[1]}\n` +
                           `**Tarde:** ${metroConfig.horarioExpreso.evening[0]} - ${metroConfig.horarioExpreso.evening[1]}\n` +
                           `Líneas: ${metroConfig.expressLines.map(l => metroConfig.linesEmojis[l]).join(' ')}`,
                    inline: false
                });
            }

            await interaction.editReply({ 
                embeds: [scheduleEmbed] 
            });

        } catch (error) {
            console.error('Error en /metro horario:', error);
            await interaction.editReply({
                content: '❌ Error al obtener los horarios',
                ephemeral: true
            });
        }
    }
};