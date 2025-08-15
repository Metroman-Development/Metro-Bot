const metroConfig = require('../../../config/metro/metroConfig');
const TimeHelpers = require('../../../core/chronos/timeHelpers');

module.exports = {
    name: 'tarifa',
    description: 'Muestra las tarifas del Metro de Santiago.',
    async execute(ctx, metro) {
        const currentPeriod = TimeHelpers.getCurrentPeriod();
        const nextTransition = TimeHelpers.getNextTransition();

        const fares = {
            'Punta': {
                'Normal (BIP)': metroConfig.tarifario.t_metro_punta,
                'Estudiante (TNE)': metroConfig.tarifario.t_estudiante_punta,
                'Adulto Mayor': metroConfig.tarifario.t_adulto_punta,
                'BIP Adulto Mayor': metroConfig.tarifario.t_adultobip_punta,
            },
            'Valle': {
                'Normal (BIP)': metroConfig.tarifario.t_metro_valle,
                'Estudiante (TNE)': metroConfig.tarifario.t_estudiante_valle,
                'Adulto Mayor': metroConfig.tarifario.t_adulto_valle,
                'BIP Adulto Mayor': metroConfig.tarifario.t_adultobip_valle,
            },
            'Bajo': {
                'Normal (BIP)': metroConfig.tarifario.t_metro_bajo,
                'Estudiante (TNE)': metroConfig.tarifario.t_estudiante_bajo,
                'Adulto Mayor': metroConfig.tarifario.t_adulto_bajo,
                'BIP Adulto Mayor': metroConfig.tarifario.t_adultobip_bajo,
            }
        };

        let response = `*Tarifas del Metro de Santiago*\n\n`;
        response += `*Período Actual:* ${currentPeriod.name} (${TimeHelpers.formatForEmbed()})\n`;
        response += `*Próximo Cambio:* ${nextTransition.time} - ${nextTransition.message}\n\n`;

        for (const period in fares) {
            response += `*${period}*\n`;
            for (const type in fares[period]) {
                response += `  - ${type}: $${fares[period][type]}\n`;
            }
            response += '\n';
        }

        return ctx.replyWithMarkdown(response);
    }
};
