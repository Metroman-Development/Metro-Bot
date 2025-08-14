const { EmbedBuilder } = require('discord.js');
const metroConfig = require('../../../config/metro/metroConfig');
const TimeHelpers = require('../../chronos/timeHelpers');
const moment = require('moment-timezone');
const logger = require('../../../events/logger');

class AnnouncementManager {
    constructor(client, uiStrings = {}) {
        if (!client) throw new Error('Discord client is required');
        
        this.client = client;
        this.uiStrings = this._validateStrings(uiStrings);
        this.announcementChannel = null;
        this.lastAnnouncement = null;
        this.errorChannelId = metroConfig.errorChannelId;
        this._statusColors = {
            critical: '#FF0000',
            high: '#FFA500',
            medium: '#FFFF00',
            low: '#808080',
            normal: '#7289DA',
            express: '#FFA500',
            event: '#9B59B6'
        };
    }

    async initialize() {
        try {
            if (!metroConfig.announcementChannelId) {
                logger.warn('[AnnouncementManager] announcementChannelId is not set in config. Announcements disabled.');
                this.announcementChannel = null;
                return false;
            }

            this.announcementChannel = await this.client.channels.fetch(
                metroConfig.announcementChannelId
            );
            
            if (!this.announcementChannel) {
                const notFoundError = new Error('Announcement channel not found');
                await this._logError('Initialization failed', notFoundError, {
                    channelId: metroConfig.announcementChannelId
                });
                logger.warn(`[AnnouncementManager] Announcement channel with ID ${metroConfig.announcementChannelId} not found. Announcements disabled.`);
                return false;
            }
            
            logger.debug('[AnnouncementManager] Initialized successfully');
            return true;
        } catch (error) {
            await this._logError('Initialization failed', error, {
                channelId: metroConfig.announcementChannelId
            });
            logger.error(`[AnnouncementManager] Failed to fetch announcement channel: ${error.message}. Announcements will be disabled.`);
            this.announcementChannel = null;
            return false;
        }
    }

    async processChangeMessages(messages, severity = 'medium') {
        if (!messages) {
            await this._logError('Null messages received', 
                new Error('Messages parameter cannot be null'));
            return;
        }

        const messageList = Array.isArray(messages) ? messages : [messages];
        
        if (messageList.length === 0) {
            return;
        }

        try {
            for (const msg of messageList) {
                try {
                    if (!msg) continue;

                    // Handle pre-built embeds
                    if (msg instanceof EmbedBuilder || msg.data?.title) {
                        await this._sendSafeEmbed(msg, 'system', severity);
                        continue;
                    }

                    const normalizedMsg = this._normalizeMessage(msg);
                    const effectiveSeverity = normalizedMsg.severity || severity;
                    
                    if (normalizedMsg.isError) {
                        await this._handleErrorMessage(normalizedMsg);
                    } else {
                        await this._sendStatusChangeEmbed(normalizedMsg, effectiveSeverity);
                    }
                } catch (messageError) {
                    await this._logError('Message processing failed', messageError, {
                        message: msg,
                        severity
                    });
                }
            }
        } catch (error) {
            await this._logError('Critical processing error', error, {
                messageCount: messageList.length
            });
            throw error;
        }
    }

    async sendInitialAnnouncement(data) {
        try {
            const announcementData = data.data || data;
            const embed = new EmbedBuilder()
                .setTitle("🚇 Estado Inicial del Servicio")
                .setColor(this._statusColors.normal)
                .setDescription("**Estado inicial del sistema de transporte**")
                .addFields(
                    { 
                        name: 'Horario', 
                        value: announcementData.schedule?.period || "Horario regular",
                        inline: true 
                    },
                    { 
                        name: 'Líneas Operativas', 
                        value: announcementData.lines?.length > 0 
                            ? announcementData.lines
                                .map(line => `• ${this._formatLineName(line.id || line)}`)
                                .join('\n')
                            : 'Todas las líneas operativas',
                        inline: false 
                    }
                )
                .setFooter({ 
                    text: `Inicializado: ${TimeHelpers.formatDateTime(TimeHelpers.currentTime.toDate())}`
                });

            return await this._sendSafeEmbed(embed, 'initial');
        } catch (error) {
            await this._logError('Initial announcement failed', error, { data });
            return false;
        }
    }

    async sendExpressUpdate(data) {
        try {
            const isStarting = data.event?.action === 'start';
            const title = isStarting 
                ? this.uiStrings.ANNOUNCEMENTS.EXPRESS_START
                : this.uiStrings.ANNOUNCEMENTS.EXPRESS_END;

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setColor(this._statusColors.express)
                .setDescription(`**Servicio Expreso ${isStarting ? 'iniciado' : 'finalizado'}**`)
                .addFields(
                    { name: 'Horario', value: data.event?.period || 'No especificado', inline: true },
                    { name: 'Duración', value: data.timing?.remainingDuration || 'No especificada', inline: true },
                    { 
                        name: 'Líneas afectadas', 
                        value: data.context?.affectedLines?.length > 0
                            ? data.context.affectedLines
                                .map(line => `• ${this._formatLineName(line)}`)
                                .join('\n')
                            : 'Ninguna',
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `Actualizado: ${TimeHelpers.formatDateTime(TimeHelpers.currentTime.toDate())}`
                });

            return await this._sendSafeEmbed(embed, 'express');
        } catch (error) {
            await this._logError('Express update failed', error, { data });
            return false;
        }
    }

    async sendServiceChange(data) {
        try {
            const isOpening = data.type === 'open';
            const title = isOpening
                ? this.uiStrings.ANNOUNCEMENTS.SERVICE_OPEN
                : this.uiStrings.ANNOUNCEMENTS.SERVICE_CLOSE;

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setColor(isOpening ? '#00FF00' : '#FF0000')
                .setDescription(`**Servicio ${data.dayType || 'regular'} ${isOpening ? 'iniciado' : 'finalizado'}**`)
                .addFields(
                    { name: 'Horario actual', value: data.systemState?.period || 'No especificado', inline: true },
                    { 
                        name: 'Próximo cambio', 
                        value: data.systemState?.nextTransition?.time || 'No programado',
                        inline: true 
                    }
                )
                .setFooter({ 
                    text: `Actualizado: ${TimeHelpers.formatDateTime(TimeHelpers.currentTime.toDate())}`
                });

            return await this._sendSafeEmbed(embed, 'service');
        } catch (error) {
            await this._logError('Service change failed', error, { data });
            return false;
        }
    }

    async sendEventAnnouncement(data) {
        try {
            const isStarting = data.event?.action === 'start';
            const title = isStarting
                ? this.uiStrings.ANNOUNCEMENTS.EVENT_START
                : this.uiStrings.ANNOUNCEMENTS.EVENT_END;

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setColor(this._statusColors.event)
                .setDescription(`**${data.event?.name || 'Evento sin nombre'}**`)
                .addFields(
                    { name: 'Duración', value: `${data.schedule?.start || '?'} - ${data.schedule?.end || '?'}`, inline: true },
                    { name: 'Tiempo restante', value: `${data.schedule?.remaining || '?'} minutos`, inline: true },
                    { 
                        name: 'Estaciones afectadas', 
                        value: data.impact?.stations?.length > 0 
                            ? data.impact.stations.slice(0, 5).join(', ') + 
                              (data.impact.stations.length > 5 ? ` (+${data.impact.stations.length - 5} más)` : '')
                            : 'Ninguna',
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `Evento ${isStarting ? 'iniciado' : 'finalizado'} el ${TimeHelpers.formatDateTime(TimeHelpers.currentTime.toDate())}`
                });

            return await this._sendSafeEmbed(embed, 'event');
        } catch (error) {
            await this._logError('Event announcement failed', error, { data });
            return false;
        }
    }

    async _sendSafeEmbed(embed, type, severity = 'medium') {
        if (!this.announcementChannel) {
            logger.debug('[AnnouncementManager] Announcement channel not available, skipping sending embed.');
            return false;
        }

        try {
            // Apply severity color if not already set
            if (!embed.data.color) {
                embed.setColor(this._statusColors[severity] || this._statusColors.normal);
            }
            
            const message = await this.announcementChannel.send({ embeds: [embed] });
                
            if (message) {
                this.lastAnnouncement = {
                    type,
                    time: TimeHelpers.currentTime.toDate(),
                    message,
                    severity
                };
            }
                
            return true;
        } catch (error) {
            await this._logError('Embed send failed', error, {
                type,
                severity,
                channelId: this.announcementChannel.id,
                embedTitle: embed.data?.title || 'N/A'
            });
            return false;
        }
    }

    async _handleErrorMessage(msg) {
        const embed = new EmbedBuilder()
            .setTitle('⚠️ Error del Sistema')
            .setColor(this._statusColors.critical)
            .setDescription(msg.message || 'Ocurrió un error no especificado')
            .setFooter({ 
                text: `Error ocurrido: ${TimeHelpers.formatDateTime(TimeHelpers.currentTime.toDate())}`
            });
        
        await this._sendSafeEmbed(embed, 'error', 'critical');
    }

    async _sendStatusChangeEmbed(msg, severity) {
        const embed = new EmbedBuilder()
            .setTitle(this._getStatusTitle(msg))
            .setColor(this._getStatusColor(msg, severity))
            .setDescription(this._getStatusDescription(msg))
            .addFields(this._getStatusFields(msg))
            .setFooter({ 
                text: `Actualizado: ${TimeHelpers.formatDateTime(TimeHelpers.currentTime.toDate())}`
            });
        
        await this._sendSafeEmbed(embed, msg.type, severity);
    }

    _normalizeMessage(msg) {
        if (typeof msg === 'object' && msg !== null) {
            return msg;
        }
        
        if (typeof msg === 'string') {
            return {
                type: msg.startsWith('-#') ? 'error' : 'generic',
                isError: msg.startsWith('-#'),
                message: msg.replace('-#', '').trim(),
                severity: 'critical'
            };
        }
        
        return {
            type: 'error',
            isError: true,
            message: 'Invalid message format received',
            severity: 'critical'
        };
    }

    _getStatusTitle(msg) {
        const typeMap = {
            station: `🚉 ${msg.data?.name || 'Estación'} - Cambio de Estado`,
            line: `🚇 ${msg.data?.name || 'Línea'} - Cambio de Estado`,
            default: 'Actualización del Sistema'
        };
        return typeMap[msg.type] || typeMap.default;
    }

    _getStatusColor(msg, severity) {
        return this._statusColors[msg.severity || severity] || this._statusColors.normal;
    }

    _getStatusDescription(msg) {
        const status = msg.data?.status || msg.data?.description || 'Estado cambiado';
        return `**${status.toUpperCase()}**`;
    }

    _getStatusFields(msg) {
        const fields = [];
        
        if (msg.data?.from && msg.data?.to) {
            fields.push({
                name: 'Horario',
                value: `${msg.data.from} → ${msg.data.to}`,
                inline: true
            });
        }
        
        if (msg.data?.line) {
            fields.push({
                name: 'Línea',
                value: msg.data.line,
                inline: true
            });
        }
        
        if (msg.data?.description) {
            fields.push({
                name: 'Detalles',
                value: msg.data.description,
                inline: false
            });
        }
        
        return fields;
    }

    _formatLineName(lineId) {
        try {
            const lineNumber = lineId.replace(/l/i, '');
            return `Línea ${lineNumber.toUpperCase()}`;
        } catch (error) {
            console.error('Line name formatting failed:', error);
            return lineId;
        }
    }

    _validateStrings(uiStrings) {
        const defaults = {
            ANNOUNCEMENTS: {
                EXPRESS_START: "🚄 SERVICIO EXPRESO INICIADO",
                EXPRESS_END: "🚄 SERVICIO EXPRESO FINALIZADO",
                SERVICE_OPEN: "🚇 SERVICIO INICIADO",
                SERVICE_CLOSE: "🚇 SERVICIO FINALIZADO",
                EVENT_START: "🎉 EVENTO ESPECIAL INICIADO",
                EVENT_END: "🎉 EVENTO ESPECIAL FINALIZADO",
                DAY_TYPE_CHANGE: "📅 CAMBIO DE TIPO DE DÍA",
                FARE_PERIOD_CHANGE: "💰 CAMBIO DE TARIFA",
                TITLES: {
                    EXPRESS: "Actualización de Servicio Expreso",
                    SERVICE: "Cambio en Horario de Servicio",
                    EVENT: "Notificación de Evento Especial",
                    DAY_TYPE: "Cambio de Tipo de Día",
                    FARE_PERIOD: "Actualización de Tarifas"
                }
            },
            SYSTEM: {
                ERROR: {
                    CHANNEL_FETCH: "❌ Error al obtener canal de anuncios",
                    MESSAGE_FETCH: "❌ Error al publicar anuncio"
                }
            }
        };

        return {
            ANNOUNCEMENTS: { ...defaults.ANNOUNCEMENTS, ...uiStrings.ANNOUNCEMENTS },
            SYSTEM: { ...defaults.SYSTEM, ...uiStrings.SYSTEM }
        };
    }

    async _logError(context, error, metadata = {}) {
        try {
            const errorChannel = await this.client.channels.fetch(this.errorChannelId).catch(() => null);
            if (!errorChannel) {
                console.error('Error channel unavailable:', context, error);
                return;
            }

            await errorChannel.send({
                content: `**AnnouncementManager Error**\n` +
                         `• Context: ${context}\n` +
                         `• Error: \`\`\`${error.stack || error.message || error}\`\`\`` +
                         (Object.keys(metadata).length > 0 ? 
                          `\n• Metadata: \`\`\`json\n${JSON.stringify(metadata, null, 2)}\`\`\`` : '')
            }).catch(console.error);
        } catch (logError) {
            console.error('CRITICAL: Error logging failed:', {
                originalError: error,
                loggingError: logError,
                context,
                metadata
            });
        }
    }

    enableDebugMode() {
        console.log('[AnnouncementManager] Debug mode enabled');
        this.debug = true;
        return this;
    }
}

module.exports = AnnouncementManager;