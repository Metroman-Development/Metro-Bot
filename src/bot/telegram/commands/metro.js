const MetroInfoProvider = require('../../../utils/MetroInfoProvider');

module.exports = {
    name: 'metro',
    description: 'Muestra información general del Metro de Santiago.',
    async execute(ctx, metro) {
        const infoProvider = MetroInfoProvider;
        const systemInfo = infoProvider.getFullData().system;

        if (!systemInfo) {
            return ctx.reply('No se encontró información del sistema Metro.');
        }

        let response = `*${systemInfo.name}*\n\n`;
        response += `*Sistema:* ${systemInfo.system}\n`;
        response += `*Inauguración:* ${systemInfo.inauguration}\n`;
        response += `*Longitud total:* ${systemInfo.technicalCharacteristics.length}\n`;
        response += `*Estaciones:* ${systemInfo.technicalCharacteristics.stations}\n`;
        response += `*Líneas en operación:* ${systemInfo.operation.lines}\n`;
        response += `*Trenes en flota:* ${systemInfo.operation.fleet}\n`;
        response += `*Pasajeros diarios:* ${systemInfo.operation.passengers.toLocaleString()}\n`;
        response += `*Electrificación:* ${systemInfo.technicalCharacteristics.electrification}\n`;
        response += `*Velocidad máxima:* ${systemInfo.technicalCharacteristics.maxSpeed}\n`;
        response += `*Velocidad promedio:* ${systemInfo.operation.averageSpeed}\n`;

        return ctx.replyWithMarkdown(response);
    }
};
