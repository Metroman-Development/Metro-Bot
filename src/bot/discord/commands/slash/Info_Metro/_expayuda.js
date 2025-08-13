const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../../../../config/metro/metroConfig');

module.exports = {
    parentCommand: 'expreso',
    data: (subcommand) => subcommand
        .setName('ayuda')
        .setDescription('Explica cómo funcionan las rutas expresas en el Metro de Santiago'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const embed = new EmbedBuilder()
                .setTitle(`${config.logoMetroEmoji} Ruta Expresa - Guía Completa`)
                .setColor('#EA0A2E') // Metro's red color
                //.setThumbnail(config.metroLogo.principal)
                .setDescription('Todo lo que necesitas saber sobre el servicio de trenes expresos')
                .addFields(
                    {
                        name: `${config.stationIcons.roja.emoji} ${config.stationIcons.roja.message}`,
                        value: 'Para solo en Estaciones Rojas'
                    },
                    {
                        name: `${config.stationIcons.verde.emoji} ${config.stationIcons.verde.message}`,
                        value: 'Para en Estaciones Verdes'
                    },
                    {
                        name: `${config.stationIcons.comun.emoji} ${config.stationIcons.comun.message}`,
                        value: '- No hay trenes Ruta Común, sin embargo en estas Estaciones todos los Trenes se detienen\n- Habitualmente son Estaciones con Harto Flujo o Estaciones de Combinación'
                    },
                    {
                        name: '🚄 Líneas con Servicio Expreso',
                        value: config.expressLines.map(line => 
                            `${config.linesEmojis[line]} Línea ${line.slice(1)}`
                        ).join('\n'),
                        inline: true
                    },
                    {
                        name: '⏰ Horario Expreso',
                        value: `Lunes a Viernes (Excepto Festivos):\nMañana:  
${config.horarioExpreso.morning.join(' - ')}\nTarde: ${config.horarioExpreso.evening.join(' - ')}`,
                        inline: true
                    },
                    {
                        name: '📌 Cómo Identificarlos',
                        value: `• ${config.stationIcons.roja.emoji}/${config.stationIcons.verde.emoji} en cabinas\n• Avisos sonoros\n• Letreros en andenes`
                    },
                    {
                        name: '🔄 Reglas de Trasbordo',
                        value: `1. Mismo color → Toma el tren que venga\n2. Destino Común → Cualquier tren\n3. Distintos colores → Trasbordo en Estación Común`
                    }
                )
                //.setImage(config.metroLogo.logoColores)
                .setFooter({ 
                    text: 'Información oficial de Metro de Santiago, usa /expreso info para Estaciones por Línea, usa /metro planificar con Horario PUNTA para ayuda en tu ruta',
                    iconURL: config.metroLogo.v4 
                });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error en comando ayuda:', error);
            await interaction.editReply({
                content: `${config.statusMapping['2'].emoji} Error al cargar la información de ayuda`,
                ephemeral: true
            });
        }
    }
};