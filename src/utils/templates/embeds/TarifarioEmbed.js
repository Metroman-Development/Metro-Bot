const BaseEmbed = require('../../../templates/embeds/baseEmbed.js');

class TarifarioEmbed extends BaseEmbed {
    constructor(config) {
        super(config);
        this.periodInfo = {
            'PUNTA': { name: 'Hora Punta', emoji: '⏰', color: 0xFFD700 },
            'VALLE': { name: 'Hora Valle', emoji: '🕒', color: 0x00FF00 },
            'BAJO': { name: 'Hora Baja', emoji: '🌙', color: 0x0000FF },
            'EVENT': { name: 'Evento Especial', emoji: '🎪', color: 0x9B59B6 },
            'DEFAULT': { name: 'Período', emoji: '⏱️', color: 0x009688 }
        };

        this.fareTypes = {
            metro: { name: '🚇 Metro Normal', fallback: 't_metro_normal' },
            combinacion: { name: '🔄 Combinación', fallback: 't_combinacion_normal' },
            estudiante: { name: '🎓 Estudiantil', fallback: 't_estudiante_normal' },
            adulto: { name: '👴 Adulto Mayor', fallback: 't_adulto_normal' },
            adultobip: { name: '💳 BIP!', fallback: 't_adultobip_normal' },
            transantiago: { name: '🚌 Transantiago', fallback: 't_transantiago', isStatic: true }
        };
    }

    createOverview(periodData, fares) {
        // Validate inputs
        if (!periodData?.period || typeof periodData.period !== 'string') {
            throw new Error('Invalid period data provided');
        }

        if (!fares || typeof fares !== 'object') {
            throw new Error('Invalid fares data provided');
        }

        // Get period info with fallback
        const period = periodData.period.toUpperCase();
        const currentPeriod = this.periodInfo[period] || this.periodInfo.DEFAULT;
        const normalizedPeriod = period in this.periodInfo ? period : 'DEFAULT';

        // Create base embed
        const embed = this.createEmbed({
            title: `📊 Tarifario Completo - ${currentPeriod.name} ${currentPeriod.emoji}`,
            description: 'Selecciona un tipo de tarifa para ver detalles específicos',
            color: currentPeriod.color,
            thumbnail: this.metro.config.metroLogo.primary
        });

        // Add all fare fields
        Object.entries(this.fareTypes).forEach(([key, fareType]) => {
            const fareKey = fareType.isStatic
                ? fareType.fallback
                : `t_${key}_${normalizedPeriod.toLowerCase()}`;

            const amount = fares[fareKey] ?? fares[fareType.fallback] ?? 'N/A';

            embed.addFields({
                name: fareType.name,
                value: `$${amount}`,
                inline: true
            });
        });

        return embed;
    }

    createDetailView(fareType, periodData, fareValue) {
        // Validate inputs
        if (!this.fareTypes[fareType]) {
            throw new Error('Invalid fare type provided');
        }

        if (!periodData?.period || typeof periodData.period !== 'string') {
            throw new Error('Invalid period data provided');
        }

        const currentPeriod = this.periodInfo[periodData.period] || this.periodInfo.DEFAULT;
        const nextChange = periodData.nextChange?.message || 'No hay cambios programados';

        return this.createEmbed({
            title: `📋 Detalles de Tarifa ${this.getFareTypeName(fareType)}`,
            description: `Valor actual: $${fareValue || 'N/A'}`,
            fields: [
                {
                    name: 'Período Actual',
                    value: `${currentPeriod.name} ${currentPeriod.emoji}`,
                    inline: true
                },
                {
                    name: 'Próximo Cambio',
                    value: nextChange,
                    inline: true
                }
            ],
            footer: { text: 'Usa los botones para navegar entre tarifas' }
        });
    }

    getFareTypeName(type) {
        return this.fareTypes[type]?.name.replace(/[^\w\s]/g, '') || type;
    }
}

module.exports = TarifarioEmbed;
