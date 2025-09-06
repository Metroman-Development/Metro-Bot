const { MetroInfoProvider } = require('../../../utils/MetroInfoProvider');

module.exports = {
    name: 'intermodal',
    description: 'Muestra información de una estación intermodal.',
    async execute(ctx, metro) {
        const args = ctx.message.text.split(' ').slice(1);
        const infoProvider = MetroInfoProvider.getInstance();
        const intermodalData = infoProvider.getFullData().intermodal;

        if (args.length === 0) {
            const stationNames = Object.values(intermodalData.stations).map(s => s.name).join('\n');
            return ctx.reply(`Por favor, especifica una estación intermodal. Las estaciones disponibles son:\n${stationNames}`);
        }

        const stationName = args.join(' ');
        const station = Object.values(intermodalData.stations).find(s => s.name.toLowerCase() === stationName.toLowerCase());

        if (!station) {
            return ctx.reply('No se encontró la estación intermodal especificada.');
        }

        const buses = intermodalData.buses.filter(b => b.station_id === station.id);

        let response = `*${station.name}*\n\n`;
        response += `*Ubicación:* ${station.location}\n`;
        response += `*Comuna:* ${station.commune}\n`;
        response += `*Servicios:* ${station.services}\n\n`;

        if (buses.length > 0) {
            response += '*Buses:*\n';
            buses.forEach(bus => {
                response += `  - *${bus.route}* (${bus.type}): ${bus.destination}\n`;
            });
        } else {
            response += '*No hay información de buses para esta estación.*';
        }

        return ctx.replyWithMarkdown(response);
    }
};
