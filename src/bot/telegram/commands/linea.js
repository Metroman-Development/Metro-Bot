const { MetroInfoProvider } = require('../../../utils/MetroInfoProvider');

module.exports = {
    name: 'linea',
    description: 'Muestra información de una línea del Metro de Santiago.',
    async execute(ctx) {
        const args = ctx.message.text.split(' ').slice(1);
        if (args.length === 0) {
            return ctx.reply('Por favor, especifica una línea (ej: /linea l1).');
        }

        const lineId = args[0].toLowerCase();
        const infoProvider = MetroInfoProvider.getInstance();
        const lineInfo = infoProvider.getLine(lineId);

        if (!lineInfo) {
            return ctx.reply('No se encontró información para esta línea.');
        }

        const stations = infoProvider.getStations();
        const lineStations = Object.values(stations).filter(s => s.line_id === lineId);
        const communes = [...new Set(lineStations.map(s => s.commune))];

        let response = `*Información de la ${lineInfo.name}*\n\n`;
        response += `*Nombre:* ${lineInfo.name}\n`;
        response += `*Color:* ${lineInfo.color}\n`;
        response += `*Estado:* ${lineInfo.app_message}\n`;
        response += `*Total de estaciones:* ${lineInfo.total_stations}\n`;
        response += `*Longitud total:* ${lineInfo.total_length_km} km\n`;
        response += `*Comunas:* ${communes.join(', ')}\n`;

        return ctx.replyWithMarkdown(response);
    }
};
