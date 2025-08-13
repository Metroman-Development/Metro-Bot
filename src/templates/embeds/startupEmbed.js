const { STATUS_CODES } = require('../../core/status/config/statusConfig');
const moment = require('moment-timezone');

module.exports = {
    createBootupEmbed: function(botName, status, commands, events, version, servers, modules, env) {
        const statusConfig = STATUS_CODES[Object.keys(STATUS_CODES).find(
            key => STATUS_CODES[key].name === status.toLowerCase()
        )] || STATUS_CODES[1];

        return {
            title: `${botName} Startup`,
            color: parseInt(statusConfig.color.replace('#', '0x')), 
            fields: [
                { name: '🛠️ Status', value: `${statusConfig.emoji} ${statusConfig.name}`, inline: true },
                { name: '📅 Date', value: moment().tz('America/Santiago').format('LLL'), inline: true },
                { name: '📚 Commands', value: commands.toString(), inline: true },
                { name: '🗓️ Events', value: events.toString(), inline: true },
                { name: '🔖 Version', value: version, inline: true },
                { name: '🖥️ Servers', value: servers.toString(), inline: true },
                { name: '🧩 Modules', value: modules.join(', '), inline: true },
                { name: '🌐 Environment', value: env, inline: true }
            ],
            timestamp: new Date()
        };
    },

    createErrorEmbed: function(error) {
        return {
            title: '❌ Startup Failure',
            description: `**${error.message}**`,
            color: 0xff0000,
            fields: [
                {
                    name: 'Stack Trace',
                    value: `\`\`\`${error.stack || 'No stack trace available'}\`\`\``
                },
                {
                    name: 'Time',
                    value: moment().tz('America/Santiago').format('LLLL')
                }
            ],
            timestamp: new Date()
        };
    }
};