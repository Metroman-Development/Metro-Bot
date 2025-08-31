const { EmbedBuilder } = require('discord.js');
const metroConfig = require('../../../config/metro/metroConfig');
const timeUtils = require('../../../utils/timeHelpers');

class FarePeriodChangesAnnouncer {
    constructor() {
    }

    generateDiscordMessages(periodInfo) {
        const { type, name, start, end } = periodInfo;
        const embed = new EmbedBuilder()
            .setTitle(`Cambio de período tarifario: ${name}`)
            .setColor(metroConfig.farePeriods[type].color)
            .setDescription(`Ha comenzado el período ${name}.`)
            .addFields(
                { name: 'Inicio', value: start, inline: true },
                { name: 'Fin', value: end, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Metro de Santiago', iconURL: metroConfig.metroLogo.principal });

        return [embed];
    }

    generateTelegramMessages(periodInfo) {
        const { type, name, start, end } = periodInfo;
        const message = `🚇 **Cambio de período tarifario** 🚇\n\nHa comenzado el período **${name}**.\n\n*Inicio:* ${start}\n*Fin:* ${end}`;
        return [message];
    }
}

module.exports = FarePeriodChangesAnnouncer;
