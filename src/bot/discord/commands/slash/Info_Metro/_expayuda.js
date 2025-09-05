const { SlashCommandSubcommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../../../../config/metro/metroConfig');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('ayuda')
        .setDescription('Explica cómo funcionan las rutas expresas en el Metro de Santiago'),

    async execute(interaction) {
        await interaction.deferReply();

        const embed = new EmbedBuilder()
            .setTitle(`${config.logoMetroEmoji} Ruta Expresa - Guía Completa`)
            .setColor('#EA0A2E') // Metro's red color
            .setDescription('Todo lo que necesitas saber sobre el servicio de trenes expresos')
            .addFields(
                {
                    name: `${config.routeStyles.roja.emoji} ${config.routeStyles.roja.message}`,
                    value: 'Para solo en Estaciones Rojas'
                },
                {
                    name: `${config.routeStyles.verde.emoji} ${config.routeStyles.verde.message}`,
                    value: 'Para en Estaciones Verdes'
                },
                {
                    name: `${config.routeStyles.comun.emoji} ${config.routeStyles.comun.message}`,
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
                    value: `• ${config.routeStyles.roja.emoji}/${config.routeStyles.verde.emoji} en cabinas\n• Avisos sonoros\n• Letreros en andenes`
                },
                {
                    name: '🔄 Reglas de Trasbordo',
                    value: `1. Mismo color → Toma el tren que venga\n2. Destino Común → Cualquier tren\n3. Distintos colores → Trasbordo en Estación Común`
                }
            )
            .setFooter({
                text: 'Información oficial de Metro de Santiago, usa /expreso info para Estaciones por Línea, usa /metro planificar con Horario PUNTA para ayuda en tu ruta',
                iconURL: config.metroLogo.v4
            });

        await interaction.editReply({ embeds: [embed] });
    }
};