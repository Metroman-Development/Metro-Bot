const { EmbedBuilder } = require('discord.js');
const TimeHelpers = require('../../../utils/timeHelpers');
const chronosConfig = require('../../../config/chronosConfig');
const announcementStrings = require('../../../config/announcementStrings.json');
const { getClient, getTelegramBot } = require('../../../utils/clientManager');

class AnnouncementService {
    constructor() {
        this.timeHelpers = new TimeHelpers();
    }

    async _sendDiscordEmbed(embed) {
        try {
            const discordClient = getClient();
            if (!discordClient) return;
            const channel = await discordClient.channels.fetch(announcementStrings.discord.channelId);
            if (channel && channel.isTextBased()) {
                await channel.send({ embeds: [embed] });
            }
        } catch (error) {
            if (error.message !== 'Client has not been initialized. Call setClient() first.') {
                console.error('Failed to send Discord announcement:', error);
            }
        }
    }

    async _sendTelegramMessage(message) {
        try {
            const telegramBot = getTelegramBot();
            if (!telegramBot) return;
            await telegramBot.sendMessage(announcementStrings.telegram.chatId, message, { parse_mode: 'Markdown' });
        } catch (error) {
            if (error.message !== 'Telegram bot has not been initialized. Call setTelegramBot() first.') {
                console.error('Failed to send Telegram announcement:', error);
            }
        }
    }

    async announceServiceTransition(type, operatingHours) {
        const isStart = type === 'start';
        const strings = announcementStrings.discord.serviceTransition[type];
        const telegramStrings = announcementStrings.telegram.serviceTransition[type];
        const color = isStart ? 0x2ECC71 : 0xE74C3C;

        const embed = new EmbedBuilder()
            .setTitle(strings.title)
            .setColor(color)
            .setDescription(strings.description)
            .addFields(
                {
                    name: 'Horario',
                    value: isStart
                        ? `**Apertura:** ${operatingHours.opening}`
                        : `**Cierre:** ${operatingHours.closing}`,
                    inline: true
                },
                {
                    name: 'Próximo Horario',
                    value: isStart
                        ? `Cierre programado: ${operatingHours.closing}`
                        : `Apertura programada: ${this.timeHelpers.getNextServiceTransition().format('HH:mm')} (mañana)`,
                    inline: true
                }
            )
            .setFooter({ text: this._getFooterText() })
            .setTimestamp();

        if (operatingHours.isExtended) {
            embed.addFields({
                name: '⚠ Horario Extendido',
                value: `El servicio opera con horario extendido hasta ${operatingHours.extension[1]} debido a ${operatingHours.eventName}`,
                inline: false
            });
        }

        await this._sendDiscordEmbed(embed);
        await this._sendTelegramMessage(telegramStrings);
    }

    async announceFarePeriodChange(periodType, periodInfo) {
        const strings = announcementStrings.discord.farePeriodChange[periodType];
        const telegramStrings = announcementStrings.telegram.farePeriodChange[periodType];
        const color = periodType === 'PUNTA' ? 0xE67E22 : (periodType === 'BAJO' ? 0x2ECC71 : 0x3498DB);

        const embed = new EmbedBuilder()
            .setTitle(strings.title)
            .setColor(color)
            .setDescription(strings.description)
            .addFields(
                {
                    name: 'Duración',
                    value: `Hasta: ${periodInfo.end || this.timeHelpers.getNextTransition().time}`,
                    inline: true
                }
            )
            .setFooter({ text: this._getFooterText() })
            .setTimestamp();

        await this._sendDiscordEmbed(embed);
        await this._sendTelegramMessage(telegramStrings);
    }

    async announceExpressTransition(type, period) {
        const isStart = type === 'start';
        const strings = announcementStrings.discord.expressTransition[type];
        const telegramStrings = announcementStrings.telegram.expressTransition[type].replace('{period}', period === 'morning' ? 'mañana' : 'tarde');
        const color = isStart ? 0x9B59B6 : 0x95A5A6;

        const timeRange = period === 'morning'
            ? chronosConfig.expressHours.morning
            : chronosConfig.expressHours.evening;

        const embed = new EmbedBuilder()
            .setTitle(strings.title)
            .setColor(color)
            .setDescription(strings.description.replace('{period}', period === 'morning' ? 'mañana' : 'tarde'))
            .addFields(
                {
                    name: 'Horario',
                    value: isStart
                        ? `De ${timeRange.start} a ${timeRange.end}`
                        : `Servicio regular hasta ${this.timeHelpers.getOperatingHours().closing}`,
                    inline: true
                },
                {
                    name: 'Líneas',
                    value: chronosConfig.expressLines.join(', '),
                    inline: true
                }
            )
            .setFooter({ text: this._getFooterText() })
            .setTimestamp();

        await this._sendDiscordEmbed(embed);
        await this._sendTelegramMessage(telegramStrings);
    }

    async announceExtendedService(type, eventInfo) {
        const isStart = type === 'start';
        const strings = announcementStrings.discord.extendedService[type];
        const telegramStrings = announcementStrings.telegram.extendedService[type]
            .replace('{endTime}', eventInfo.endTime)
            .replace('{eventName}', eventInfo.name);
        const color = isStart ? 0xF1C40F : 0xE74C3C;

        const embed = new EmbedBuilder()
            .setTitle(strings.title)
            .setColor(color)
            .setDescription(strings.description
                .replace('{endTime}', eventInfo.endTime)
                .replace('{eventName}', eventInfo.name))
            .addFields(
                {
                    name: 'Evento',
                    value: eventInfo.name,
                    inline: true
                },
                {
                    name: 'Horario',
                    value: isStart
                        ? `Hasta: ${eventInfo.endTime}`
                        : `Próximo cierre: ${this.timeHelpers.getOperatingHours().closing}`,
                    inline: true
                }
            )
            .setFooter({ text: this._getFooterText() })
            .setTimestamp();

        if (eventInfo.affectedLines?.length > 0) {
            embed.addFields({
                name: 'Líneas Afectadas',
                value: eventInfo.affectedLines.join(', '),
                inline: false
            });
        }

        await this._sendDiscordEmbed(embed);
        await this._sendTelegramMessage(telegramStrings);
    }

    async announceStationClosures(eventInfo) {
        if (!eventInfo?.closedStations || Object.keys(eventInfo.closedStations).length === 0) {
            return;
        }

        const strings = announcementStrings.discord.stationClosures;
        let telegramStrings = announcementStrings.telegram.stationClosures.replace('{eventName}', eventInfo.name);

        const embed = new EmbedBuilder()
            .setTitle(strings.title)
            .setColor(0xE74C3C)
            .setDescription(strings.description.replace('{eventName}', eventInfo.name))
            .setFooter({ text: this._getFooterText() })
            .setTimestamp();

        for (const [line, stations] of Object.entries(eventInfo.closedStations)) {
            if (stations?.length > 0) {
                const stationList = stations.join(', ');
                embed.addFields({
                    name: `Línea ${line}`,
                    value: stationList,
                    inline: true
                });
                telegramStrings += `\n*Línea ${line}*: ${stationList}`;
            }
        }

        await this._sendDiscordEmbed(embed);
        await this._sendTelegramMessage(telegramStrings);
    }

    _getFooterText() {
        return `Metro Santiago • ${this.timeHelpers.currentTime.format('DD/MM/YYYY HH:mm')}`;
    }
}

module.exports = AnnouncementService;
