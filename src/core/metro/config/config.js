const metroConfig = require('../../../config/metro/metroConfig');

module.exports = {
    channels: {
        updates: metroConfig.updatesChannelId,
        embeds: metroConfig.embedsChannelId,
        embedMessages: metroConfig.embedMessageIds
    },
    emojis: {
        lines: metroConfig.linesEmojis,
        status: metroConfig.statusTypes,
        logo: metroConfig.logoMetroEmoji
    },
    /*schedule: {
        normal: metroConfig.horario,
        express: metroConfig.horarioExpreso,
        periods: metroConfig.horarioPeriodos
    },*/
    fares: metroConfig.tarifario,
    statusMapping: metroConfig.statusTypes,
    api: {
        endpoint: metroConfig.apiEndpoint
    }
};