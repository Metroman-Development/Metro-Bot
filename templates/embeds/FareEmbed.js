// templates/embeds/FareEmbed.js
const BaseEmbed = require('./baseEmbed');

class FareEmbed extends BaseEmbed {
    createEnhanced(fareType, periodData, fares, showDetails = false) {
        const periodNames = {
            'PUNTA': { name: 'Hora Punta', emoji: '⏰', color: 0xFFD700 },
            'VALLE': { name: 'Hora Valle', emoji: '🕒', color: 0x00FF00 },
            'BAJO': { name: 'Hora Baja', emoji: '🌙', color: 0x0000FF },
            'EVENT': { name: 'Evento Especial', emoji: '🎪', color: 0x9B59B6 }
        };

        const dayTypeNames = {
            'weekday': 'Día Laboral',
            'saturday': 'Sábado',
            'sunday': 'Domingo',
            'festive': 'Día Festivo'
        };

        const periodInfo = periodNames[periodData.period] || 
                         { name: periodData.period, emoji: '⏱️', color: 0x009688 };

        // Base embed setup
        const embed = this.createEmbed({
            title: `🚇 Tarifa ${this._getFareTypeName(fareType)} - ${periodInfo.name} ${periodInfo.emoji}`,
            color: periodInfo.color,
            thumbnail: this.metro.config.metroLogo.primary
        });

        // Add fare information
        embed.addFields({
            name: 'Valor Actual',
            value: `$${fares[`t_${fareType}_${periodData.period.toLowerCase()}`]}`,
            inline: true
        });

        // Add detailed period information if requested
        if (showDetails) {
            embed.addFields(
                {
                    name: 'Horario Actual',
                    value: dayTypeNames[periodData.dayType] || periodData.dayType,
                    inline: true
                },
                {
                    name: 'Próximo Cambio',
                    value: `${periodData.nextChange.message} a las ${periodData.nextChange.time}`,
                    inline: true
                }
            );

            if (periodData.isEvent) {
                embed.addFields({
                    name: '⚠️ Evento Especial',
                    value: 'Tarifas pueden variar debido a eventos programados',
                    inline: false
                });
            }
        }

        // Add footer with timestamp
        embed.setFooter({ 
            text: `Sistema Chronos • Actualizado: ${new Date().toLocaleTimeString('es-CL')}` 
        });

        return embed;
    }

    _getFareTypeName(type) {
        const names = {
            'metro': 'Normal',
            'combinacion': 'Combinada',
            'estudiante': 'Estudiantil',
            'adulto': 'Adulto Mayor',
            'adultobip': 'BIP!',
            'transantiago': 'Transantiago'
        };
        return names[type] || type;
    }
}

module.exports = FareEmbed;