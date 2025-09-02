const { Message, Channel } = require('discord.js');
const logger = require('../../events/logger');
const { overviewEmbed, lineEmbed } = require('../../config/statusEmbeds');
const statusEmbeds = require('../../config/statusEmbeds');

class StatusEmbedManager {
    constructor() {
        this.client = null;
        this.channel = null;
        this.overviewMessage = null;
        this.lineMessages = new Map();
        this.initialized = false;
    }

    setClient(client) {
        this.client = client;
    }

    async initialize(channelId, overviewMessageId, lineMessageIds) {
        if (!this.client) {
            logger.warn('[StatusEmbedManager] Discord client is not available. Initialization will be partial.');
        }
        try {
            if (this.client) {
                this.channel = await this.client.channels.fetch(channelId);
            } else {
                this.channel = null;
            }
            if (!this.channel) {
                logger.error(`[StatusEmbedManager] Could not find channel with ID: ${channelId}`);
                return;
            }

            this.overviewMessage = await this.channel.messages.fetch(overviewMessageId);
            if (!this.overviewMessage) {
                logger.error(`[StatusEmbedManager] Could not find overview message with ID: ${overviewMessageId}`);
                return;
            }

            for (const [lineId, messageId] of Object.entries(lineMessageIds)) {
                const message = await this.channel.messages.fetch(messageId);
                if (message) {
                    this.lineMessages.set(lineId, message);
                } else {
                    logger.error(`[StatusEmbedManager] Could not find message with ID: ${messageId} for line ${lineId}`);
                }
            }
            this.initialized = true;
            logger.info('[StatusEmbedManager] StatusEmbedManager initialized successfully.');
        } catch (error) {
            logger.error('[StatusEmbedManager] Failed to initialize StatusEmbedManager:', error);
        }
    }

    async updateAllEmbeds(data) {
        if (!this.initialized || !this.client) {
            logger.warn('[StatusEmbedManager] Attempted to update embeds before initialization or without a client.');
            return;
        }
        logger.info('[StatusEmbedManager] Updating all embeds...');
        await this.updateOverviewEmbed(data);
        for (const lineId of this.lineMessages.keys()) {
            await this.updateLineEmbed(lineId, data);
        }
    }

    async updateLineEmbed(lineId, data) {
        if (!this.initialized || !this.client) return;
        const message = this.lineMessages.get(lineId);
        if (!message) {
            logger.warn(`[StatusEmbedManager] No message found for line: ${lineId}`);
            return;
        }

        const lineData = data.lines[lineId];
        if (!lineData) {
            logger.warn(`[StatusEmbedManager] No data found for line: ${lineId}`);
            return;
        }

        const embed = statusEmbeds.lineEmbed(lineData, data.stations, new Date().toISOString());
        try {
            await message.edit({ embeds: [embed] });
            logger.info(`[StatusEmbedManager] Updated embed for line: ${lineId}`);
        } catch (error) {
            logger.error(`[StatusEmbedManager] Failed to update embed for line: ${lineId}`, error);
        }
    }

    async updateOverviewEmbed(data) {
        if (!this.initialized || !this.client) return;
        if (!this.overviewMessage) {
            logger.warn('[StatusEmbedManager] Overview message not available.');
            return;
        }

        const embed = statusEmbeds.overviewEmbed(data, new Date().toISOString());
        try {
            await this.overviewMessage.edit({ embeds: [embed] });
            logger.info('[StatusEmbedManager] Updated overview embed.');
        } catch (error) {
            logger.error('[StatusEmbedManager] Failed to update overview embed:', error);
        }
    }
}

module.exports = StatusEmbedManager;
