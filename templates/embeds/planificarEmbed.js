// templates/embeds/PlanificarEmbed.js
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const BaseEmbed = require('./baseEmbed');

class PlanificarEmbed extends BaseEmbed {
    constructor() {
        super();
        this.colors = { VALLE: '#2ecc71', PUNTA: '#f1c40f', BAJO: '#3498db' };
    }

    createSummaryEmbed(routes, start, end, period) {
        const bestRoute = routes[0];
        return {
            embed: new EmbedBuilder()
                .setTitle(`🚇 Ruta ${period} | ${bestRoute.tiempo} minutos`)
                .setColor(this.colors[period])
                .setDescription(this.buildDescription(start, end, bestRoute))
                .addFields(
                    { name: '⏱️ Tiempo Total', value: `${bestRoute.tiempo} min`, inline: true },
                    { name: '🔄 Combinaciones', value: `${bestRoute.cambios}`, inline: true },
                    { name: '🚉 Estaciones', value: `${bestRoute.estaciones}`, inline: true }
                ),
            buttons: () => new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('detalle_ruta')
                    .setLabel('Ver Detalles')
                    .setStyle(ButtonStyle.Primary)
            )
        };
    }

    buildDescription(start, end, route) {
        return `**Desde:** ${start.nombre} (Línea ${start.line.toUpperCase()})\n` +
               `**Hasta:** ${end.nombre} (Línea ${end.line.toUpperCase()})\n\n` +
               `${this.formatSteps(route.segments)}`;
    }

    formatSteps(segments) {
        return segments.map((s, i) => {
            if (s.type === 'transfer') {
                return `🔀 **Combinar a Línea ${s.line}**\n*${s.station} (${s.duration})*`;
            }
            return `🚄 **Tramo ${i + 1}:** Línea ${s.line}\n` +
                   `De *${s.from}* a *${s.to}*\n` +
                   `Dirección: ${s.direction}`;
        }).join('\n\n');
    }
}

module.exports = new PlanificarEmbed();