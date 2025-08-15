module.exports = {
    name: 'linea',
    description: 'Muestra información de una línea del Metro de Santiago.',
    async execute(ctx, metro) {
        const args = ctx.message.text.split(' ').slice(1);
        if (args.length === 0) {
            return ctx.reply('Por favor, especifica una línea (ej: /linea l1).');
        }

        const lineId = args[0].toLowerCase();
        const lineInfo = await metro.db.getLineInfo(lineId);

        if (!lineInfo) {
            return ctx.reply('No se encontró información para esta línea.');
        }

        let response = `*Información de la ${lineInfo.display_name}*\n\n`;
        response += `*Nombre:* ${lineInfo.line_name}\n`;
        response += `*Color:* ${lineInfo.line_color}\n`;
        response += `*Estado:* ${lineInfo.status_message}\n`;
        response += `*Total de estaciones:* ${lineInfo.total_stations}\n`;
        response += `*Longitud total:* ${lineInfo.total_length_km} km\n`;
        response += `*Horario de operación:* ${lineInfo.operating_hours_start} - ${lineInfo.operating_hours_end}\n`;

        return ctx.replyWithMarkdown(response);
    }
};
