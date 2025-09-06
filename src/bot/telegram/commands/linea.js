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
        const lineInfo = infoProvider.getLineData(lineId);

        if (!lineInfo) {
            return ctx.reply('No se encontró información para esta línea.');
        }

        let response = `*Información de la ${lineInfo.nombre}*\n\n`;
        response += `*Nombre:* ${lineInfo.nombre}\n`;
        response += `*Color:* ${lineInfo.color}\n`;
        response += `*Estado:* ${lineInfo.mensaje_app}\n`;
        response += `*Total de estaciones:* ${lineInfo.data['N° estaciones']}\n`;
        response += `*Longitud total:* ${lineInfo.data.Longitud}\n`;
        response += `*Comunas:* ${lineInfo.data.Comunas.join(', ')}\n`;

        return ctx.replyWithMarkdown(response);
    }
};
