module.exports = {
    name: 'metro',
    description: 'Muestra información general del Metro de Santiago.',
    async execute(ctx, metro) {
        const systemInfo = await metro.db.getSystemInfo();

        if (!systemInfo) {
            return ctx.reply('No se encontró información del sistema Metro.');
        }

        let response = `*${systemInfo.name}*\n\n`;
        response += `*Sistema:* ${systemInfo.system}\n`;
        response += `*Inauguración:* ${systemInfo.inauguration}\n`;
        response += `*Longitud total:* ${systemInfo.length}\n`;
        response += `*Estaciones:* ${systemInfo.stations}\n`;
        response += `*Líneas en operación:* ${systemInfo.lines}\n`;
        response += `*Trenes en flota:* ${systemInfo.cars}\n`;
        response += `*Pasajeros diarios:* ${systemInfo.passengers.toLocaleString()}\n`;
        response += `*Electrificación:* ${systemInfo.electrification}\n`;
        response += `*Velocidad máxima:* ${systemInfo.max_speed}\n`;
        response += `*Velocidad promedio:* ${systemInfo.average_speed}\n`;

        return ctx.replyWithMarkdown(response);
    }
};
