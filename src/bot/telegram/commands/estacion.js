const MetroInfoProvider = require('../../../utils/MetroInfoProvider');
const TelegramMessageFormatter = require('../../../formatters/TelegramMessageFormatter');
const SearchCore = require('../../../core/metro/search/SearchCore');

module.exports = {
    name: 'estacion',
    description: 'Muestra información sobre una estación de metro.',
    execute: async (ctx) => {
        const stationName = ctx.message.text.split(' ').slice(1).join(' ');

        if (!stationName) {
            return ctx.reply('Por favor, especifica el nombre de una estación.');
        }

        try {
            const infoProvider = MetroInfoProvider;
            const searchCore = new SearchCore('station');
            searchCore.setDataSource(infoProvider.getFullData());
            const results = await searchCore.search(stationName);

            if (results.length === 0) {
                return ctx.reply('No se encontró la estación especificada.');
            }

            const station = results[0];
            const stationDetails = infoProvider.getStationById(station.id);

            const formatter = new TelegramMessageFormatter();
            const message = formatter.formatStationInfo(stationDetails);

            ctx.replyWithMarkdown(message);
        } catch (error) {
            console.error('Error executing "estacion" command in Telegram:', error);
            ctx.reply('Ocurrió un error al obtener la información de la estación.');
        }
    },
};
