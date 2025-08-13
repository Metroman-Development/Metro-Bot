const { EmbedBuilder } = require('discord.js');

class Logger {
    constructor(client) {
        this.client = client;
        this.logChannelId = '901592257591930920';
    }

    async log(module, message) {
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle(`[${module}]`)
            .setDescription(message)
            .setTimestamp();

        await this._sendToChannel(embed);
    }

    async error(module, message, error) {
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle(`[${module}] ERROR`)
            .setDescription(`${message}\n\`\`\`${error}\`\`\``)
            .setTimestamp();

        await this._sendToChannel(embed);
    }

    async _sendToChannel(embed) {
        try {
            const channel = await this.client.channels.fetch(this.logChannelId);
            if (channel) await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Logger failed:', error);
        }
    }
}

module.exports = Logger;