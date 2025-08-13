const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const TimeHelpers = require('../core/chronos/timeHelpers');
const loadJsonFile = require('../utils/jsonLoader');

module.exports = class NewsWatcher {
    constructor(client, channelId, filePath = './config/news.json') {
        this.client = client;
        this.channelId = channelId;
        this.filePath = path.resolve(filePath);
        this.lastUpdate = null;
        this.watcher = null;
    }

    async initialize() {
        await this._checkForUpdates();
        this.watcher = fs.watch(this.filePath, (event) => {
            if (event === 'change') this._checkForUpdates();
        });
        console.log(`[NewsWatcher] Started watching ${this.filePath}`);
    }

    async _checkForUpdates() {
        // Disabled
    }

    async _postLatestItem(item) {
        const channel = await this.client.channels.cache.get(this.channelId);
        if (!channel) throw new Error('News channel not found');
        
        const embed = new EmbedBuilder()
            .setTitle(`📢 ${item.type.toUpperCase()}: ${item.title}`)
            .setDescription(item.content)
            .setColor(this._getColorForType(item.type))
            .addFields(
                { name: 'Source', value: item.source || 'Metro System', inline: true },
                { name: 'Priority', value: item.priority, inline: true }
            )
            .setTimestamp(new Date(item.timestamp))
            .setFooter({ text: `Auto-detected update` });

        await channel.send({ embeds: [embed] });
    }

    _getColorForType(type) {
        const colors = {
            alert: 0xE74C3C,     // Red
            update: 0x3498DB,    // Blue
            event: 0x9B59B6,     // Purple
            maintenance: 0xF39C12 // Orange
        };
        return colors[type.toLowerCase()] || 0x2ECC71; // Default green
    }

    stopWatching() {
        if (this.watcher) {
            this.watcher.close();
            console.log('[NewsWatcher] Stopped watching news file');
        }
    }
};
