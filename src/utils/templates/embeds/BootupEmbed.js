// templates/embeds/BootupEmbed.js
const BaseEmbed = require('../../../templates/embeds/baseEmbed.js');

class BootupEmbed extends BaseEmbed {
    create(botName, status, options = {}) {
        const {
            registeredCommands = [],
            loadedEvents = [],
            botVersion = '1.0.0',
            serverCount = 0,
            loadedModules = [],
            environment = 'development',
            color = '#00FF00'
        } = options;

        return this.createEmbed({
            title: '🤖 Bot Startup Status',
            description: this._buildDescription(
                botName, status, environment, botVersion,
                process.uptime(), serverCount,
                registeredCommands, loadedEvents, loadedModules
            ),
            color
        });
    }

    _buildDescription(...args) {
        const [
            botName, status, environment, version,
            uptime, serverCount, commands, events, modules
        ] = args;

        return [
            `**Bot Name:** ${botName}`,
            `**Status:** ${status}`,
            `**Environment:** ${environment}`,
            `**Version:** ${version}`,
            `**Uptime:** ${this._formatUptime(uptime)}`,
            `**Server Count:** ${serverCount}`,
            `**Registered Commands:** ${commands.join(', ') || 'None'}`,
            `**Loaded Events:** ${events.join(', ') || 'None'}`,
            `**Loaded Modules:** ${modules.join(', ') || 'None'}`
        ].join('\n');
    }

    _formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }
}

module.exports = BootupEmbed;
