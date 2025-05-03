// modules/chronos/AnnouncementService.js
// modules/chronos/AnnouncementService.js
// modules/chronos/AnnouncementService.js
const { EmbedBuilder } = require('discord.js');
const TimeHelpers = require('./timeHelpers');
const chronosConfig = require('../../config/chronosConfig');
const { getClient } = require('../../utils/clientManager');

class AnnouncementService {
    constructor() {
        this.timeHelpers = TimeHelpers;
        this.client = getClient();
        
        if (!this.client) {
            throw new Error('Discord client is not available');
        }

        this.channelId = '1347146518943105085';
        if (!this.channelId) {
            throw new Error('Announcement channel ID is not configured');
        }
    }

    async _getAnnouncementChannel() {
        try {
            const channel = await this.client.channels.fetch(this.channelId);
            if (!channel) {
                throw new Error(`Announcement channel ${this.channelId} not found`);
            }
            if (!channel.isTextBased()) {
                throw new Error(`Channel ${this.channelId} is not a text channel`);
            }
            return channel;
        } catch (error) {
            console.error('Failed to fetch announcement channel:', error);
            throw error;
        }
    }

    async _sendEmbed(embed) {
        try {
            const channel = await this._getAnnouncementChannel();
            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Failed to send announcement:', error);
            throw error;
        }
    }

    async announceServiceTransition(type, operatingHours) {
        const isStart = type === 'start';
        const title = isStart ? '🚆 Inicio del Servicio' : '🚫 Fin del Servicio';
        const color = isStart ? 0x2ECC71 : 0xE74C3C;
        
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor(color)
            .setDescription(isStart 
                ? 'El servicio de metro ha comenzado sus operaciones.' 
                : 'El servicio de metro ha finalizado por hoy.')
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

        await this._sendEmbed(embed);
    }

    async announceFarePeriodChange(periodType, periodInfo) {
        const isPeak = periodType === 'PUNTA';
        const isLow = periodType === 'BAJO';
        const title = isPeak ? '⏰ Hora Punta' : (isLow ? '🐢 Horario Bajo' : '🕒 Hora Valle');
        const color = isPeak ? 0xE67E22 : (isLow ? 0x2ECC71 : 0x3498DB);
        
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor(color)
            .setDescription(isPeak
                ? 'Se aplica tarifa de hora punta. Trenes expresos pueden estar disponibles.'
                : (isLow 
                    ? 'Se aplica tarifa reducida de horario bajo.' 
                    : 'Se aplica tarifa normal de hora valle.'))
            .addFields(
                {
                    name: 'Duración',
                    value: `Hasta: ${periodInfo.end || this.timeHelpers.getNextTransition().time}`,
                    inline: true
                }
            )
            .setFooter({ text: this._getFooterText() })
            .setTimestamp();

        await this._sendEmbed(embed);
    }

    async announceExpressTransition(type, period) {
        const isStart = type === 'start';
        const isMorning = period === 'morning';
        const title = isStart ? '🚄 Inicio Trenes Expresos' : '🚇 Fin Trenes Expresos';
        const color = isStart ? 0x9B59B6 : 0x95A5A6;
        
        const timeRange = isMorning 
            ? chronosConfig.expressHours.morning 
            : chronosConfig.expressHours.evening;

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor(color)
            .setDescription(isStart
                ? `Trenes expresos están disponibles en la ${isMorning ? 'mañana' : 'tarde'}.`
                : 'Los trenes expresos han finalizado su operación.')
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

        await this._sendEmbed(embed);
    }

    async announceExtendedService(type, eventInfo) {
        const isStart = type === 'start';
        const title = isStart ? '🕒 Horario Extendido' : '⏰ Fin Horario Extendido';
        const color = isStart ? 0xF1C40F : 0xE74C3C;
        
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor(color)
            .setDescription(isStart
                ? `El servicio se extenderá hasta ${eventInfo.endTime} debido a ${eventInfo.name}.`
                : 'El servicio ha vuelto a su horario normal.')
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

        await this._sendEmbed(embed);
    }

    async announceStationClosures(eventInfo) {
        if (!eventInfo?.closedStations || Object.keys(eventInfo.closedStations).length === 0) {
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('🚧 Estaciones Cerradas')
            .setColor(0xE74C3C)
            .setDescription(`Debido a ${eventInfo.name}, las siguientes estaciones están cerradas:`)
            .setFooter({ text: this._getFooterText() })
            .setTimestamp();

        for (const [line, stations] of Object.entries(eventInfo.closedStations)) {
            if (stations?.length > 0) {
                embed.addFields({
                    name: `Línea ${line}`,
                    value: stations.join(', '),
                    inline: true
                });
            }
        }

        await this._sendEmbed(embed);
    }

    _getFooterText() {
        return `Metro Santiago • ${this.timeHelpers.currentTime.format('DD/MM/YYYY HH:mm')}`;
    }
}

module.exports = AnnouncementService;