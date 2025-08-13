// templates/embeds/ScheduleEmbed.js
const BaseEmbed = require('./baseEmbed');

class ScheduleEmbed extends BaseEmbed {
    create(activeSchedule, horario) {
        return this.createEmbed({
            title: '🚇 Horario del Metro de Santiago',
            description: `**Horario Actualmente Activo:** ${activeSchedule}`,
            color: 0x0099FF,
            fields: [
                { name: '📅 Semana (Lunes a Viernes)', value: `${horario.Semana[0]} - ${horario.Semana[1]}`, inline: true },
                { name: '📅 Sábado', value: `${horario.Sábado[0]} - ${horario.Sábado[1]}`, inline: true },
                { name: '📅 Domingo y Festivos', value: `${horario.Domingo[0]} - ${horario.Domingo[1]}`, inline: true },
            ],
            footer: { text: 'Metro de Santiago - Información actualizada en tiempo real' },
            timestamp: true
        });
    }
}

module.exports = ScheduleEmbed;