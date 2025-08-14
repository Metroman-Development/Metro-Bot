const logger = require('../../../events/logger');
const AnnouncementManager = require('./AnnouncementManager');
const { EmbedBuilder } = require('discord.js');
const EventRegistry = require('../../../core/EventRegistry');
const TimeHelpers = require('../../chronos/timeHelpers');
const moment = require('moment-timezone');

class AnnouncementHandler {
    constructor(statusUpdater) {
        if (!statusUpdater) throw new Error('StatusUpdater instance required');
        
        this.parent = statusUpdater;
        this.manager = new AnnouncementManager(
            this.parent.client, 
            this.parent.UI_STRINGS
        );
        this.announcer = this.parent.metroCore._subsystems.changeAnnouncer;
        this.timeHelpers = TimeHelpers;
        this._timeEventHandlers = new Map();

        this._initializeTimeEventHandlers();
    }

    _initializeTimeEventHandlers() {
        // Service Transition Handler
        this._timeEventHandlers.set(EventRegistry.SERVICE_TRANSITION, {
            execute: async (payload) => {
                const isOpening = payload.data.type === 'open';
                const data = {
                    type: payload.data.isExtended ? 'extended' : 'normal',
                    dayType: this.timeHelpers.getDayType(),
                    systemState: {
                        period: this.timeHelpers.getCurrentPeriod().name,
                        nextTransition: payload.data.nextTransition
                    },
                    isOpening
                };
                await this.sendServiceChange(data);
            }
        });

        // Express Change Handler
        this._timeEventHandlers.set(EventRegistry.EXPRESS_CHANGE, {
            execute: async (payload) => {
                const data = {
                    event: {
                        action: payload.data.active ? 'start' : 'end',
                        period: payload.data.period.name,
                        friendlyName: this._getFriendlyPeriodName(payload.data.period.name)
                    },
                    timing: {
                        remainingDuration: this._calculateRemainingExpressDuration(payload),
                        endTime: payload.data.period.end
                    },
                    context: {
                        affectedLines: this._getDefaultAffectedLines(),
                        lineEmojis: this._getLineEmojis()
                    }
                };
                await this.sendExpressUpdate(data);
            }
        });

        // Day Type Change Handler
        this._timeEventHandlers.set(EventRegistry.DAY_TYPE_CHANGE, {
            template: {
                titleKey: 'DAY_TYPE_CHANGE',
                color: '#7289DA',
                descriptionFn: (data) => `📅 **El sistema ha cambiado a modo ${this._getFriendlyDayType(data.dayType)}**`,
                fields: [
                    { 
                        name: '⏱️ Próximo cambio', 
                        value: (data) => `A las ${data.nextTransition.time}`, 
                        inline: true 
                    }
                ]
            }
        });

        // Fare Period Change Handler
        this._timeEventHandlers.set(EventRegistry.FARE_PERIOD_CHANGE, {
            template: {
                titleKey: 'FARE_PERIOD_CHANGE',
                color: '#FFD700',
                descriptionFn: (data) => `💰 **Periodo tarifario cambiado a "${this._getFriendlyFarePeriod(data.name)}"**`,
                fields: [
                    { 
                        name: '📊 Tipo', 
                        value: (data) => this._getFriendlyFareType(data.periodType), 
                        inline: true 
                    }
                ]
            }
        });

        // Pending Transition Handler
        this._timeEventHandlers.set(EventRegistry.PENDING_TRANSITION, {
            execute: async (payload) => {
                const data = {
                    type: payload.data.type,
                    willBeActive: payload.data.willBeActive,
                    remainingMinutes: payload.data.remainingMinutes,
                    transitionTime: payload.data.transitionTime,
                    friendlyType: this._getFriendlyTransitionType(payload.data.type)
                };
                
                await this.sendPreTransitionAlert(data);
            }
        });
    }

    /* ====================== */
    /*  EMBED DECORATION UTILS */
    /* ====================== */
    _getFriendlyDayType(dayType) {
        const types = {
            'weekday': 'día laboral',
            'saturday': 'sábado',
            'sunday': 'domingo',
            'festive': 'festivo'
        };
        return types[dayType] || dayType;
    }

    _getFriendlyFarePeriod(periodName) {
        const periods = {
            'Hora Punta': 'Hora Punta 🚇💨',
            'Horario Normal': 'Horario Normal 🚇',
            'Fuera de Servicio': 'Fuera de Servicio 🚇❌'
        };
        return periods[periodName] || periodName;
    }

    _getFriendlyFareType(fareType) {
        const types = {
            'PUNTA': 'Hora Punta (Tarifa más alta)',
            'VALLE': 'Horario Normal (Tarifa estándar)',
            'NOCHE': 'Fuera de servicio (Sin tarifa)'
        };
        return types[fareType] || fareType;
    }

    _getFriendlyTransitionType(transitionType) {
        return transitionType === 'service' ? 'Horario de Servicio' : 'Servicio Expreso';
    }

    _getLineEmojis() {
        return {
            'L1': '🔴',
            'L2': '🟡',
            'L3': '🟣',
            'L4': '🔵',
            'L5': '🟢',
            'L6': '🟠'
        };
    }

    _getFriendlyPeriodName(periodName) {
        const periods = {
            'morning': 'Mañana ☀️',
            'evening': 'Tarde 🌆',
            'night': 'Noche 🌙'
        };
        return periods[periodName] || periodName;
    }

    /* ====================== */
    /*  CORE FUNCTIONALITY    */
    /* ====================== */

    async initialize() {
        try {
            logger.debug('[AnnouncementHandler] Initializing AnnouncementManager');
            const success = await this.manager.initialize();
            if (!success) {
                logger.warn('[AnnouncementHandler] AnnouncementManager failed to initialize. Announcement features will be disabled.');
            }
        } catch (error) {
            // This catch block should ideally not be reached now, but is kept as a safeguard.
            logger.fatal('[AnnouncementHandler] A critical error occurred during initialization', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async handleTimeEvent(payload) {
        if (!payload?.type) {
            logger.warn('[AnnouncementHandler] Invalid time event payload', payload);
            return;
        }

        const handlerConfig = this._timeEventHandlers.get(payload.type);
        if (!handlerConfig) {
            logger.debug('[AnnouncementHandler] No handler configured for time event', {
                type: payload.type
            });
            return;
        }

        try {
            logger.debug('[AnnouncementHandler] Processing time event', {
                type: payload.type,
                source: payload.metadata?.source
            });

            if (handlerConfig.execute) {
                await handlerConfig.execute(payload);
            } 
            else if (handlerConfig.template) {
                await this._handleTemplatedEvent(payload, handlerConfig.template);
            }
        } catch (error) {
            logger.error('[AnnouncementHandler] Failed to process time event', {
                error: error.message,
                type: payload.type,
                stack: error.stack,
                payload: this._sanitizePayloadForLogging(payload)
            });
        }
    }

    async _handleTemplatedEvent(payload, template) {
        const embed = new EmbedBuilder()
            .setTitle(`📢 ${this.manager.uiStrings.ANNOUNCEMENTS[template.titleKey]}`)
            .setColor(template.color)
            .setDescription(template.descriptionFn(payload.data));

        if (template.fields) {
            template.fields.forEach(field => {
                embed.addFields({
                    name: field.name,
                    value: field.value(payload.data),
                    inline: field.inline
                });
            });
        }

        embed.setFooter({ 
            text: `🔄 Actualizado: ${this.timeHelpers.formatDateTime(new Date())}` 
        });

        await this.sendEmbed(embed);
    }

    /* ====================== */
    /*  BEAUTIFUL ANNOUNCEMENTS */
    /* ====================== */

    async sendPreTransitionAlert(data) {
        try {
            const isService = data.type === 'service';
            const title = data.willBeActive 
                ? `⏳ ${isService ? 'Cambio de Horario Próximo' : 'Servicio Expreso Iniciando'}`
                : `⏳ ${isService ? 'Cierre de Servicio Próximo' : 'Servicio Expreso Finalizando'}`;
            
            const description = data.willBeActive
                ? `El ${data.friendlyType} se activará en **${data.remainingMinutes} minutos**`
                : `El ${data.friendlyType} finalizará en **${data.remainingMinutes} minutos**`;

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setColor('#FFA500')
                .setDescription(`**${description}**`)
                .addFields(
                    { 
                        name: '📅 Tipo de Cambio', 
                        value: data.friendlyType,
                        inline: true 
                    },
                    { 
                        name: '🔄 Nuevo Estado', 
                        value: data.willBeActive ? '✅ Activado' : '❌ Desactivado',
                        inline: true 
                    },
                    { 
                        name: '⏰ Hora Exacta', 
                        value: `🕒 ${moment(data.transitionTime).format('HH:mm')}`,
                        inline: true 
                    }
                )
                .setFooter({ 
                    text: `🔔 Recuerda planificar tu viaje según los nuevos horarios` 
                })
                .setThumbnail(isService ? 'https://i.imgur.com/7W2jK3T.png' : 'https://i.imgur.com/4jK7h9E.png');

            await this._sendSafeEmbed(embed, 'pre-transition');
        } catch (error) {
            logger.error('[AnnouncementHandler] Failed to send pre-transition alert', {
                error: error.message,
                stack: error.stack,
                data
            });
        }
    }

    async sendExpressUpdate(data) {
        try {
            const isStarting = data.event.action === 'start';
            const lineEmojis = data.context.lineEmojis;
            const affectedLines = data.context.affectedLines.map(line => 
                `${lineEmojis[line] || '🚇'} ${this._getLineDisplayName(line)}`).join('\n');

            const embed = new EmbedBuilder()
                .setTitle(isStarting ? '🚄 Servicio Expreso Activado' : '🚄 Servicio Expreso Desactivado')
                .setColor(isStarting ? '#FFA500' : '#808080')
                .setDescription(isStarting 
                    ? '**¡El servicio exprés está ahora disponible!**\nViaja más rápido en estas líneas durante el periodo indicado.' 
                    : '**El servicio exprés ha finalizado.**\nTodos los trenes volverán a hacer paradas regulares.')
                .addFields(
                    { 
                        name: '⏳ Periodo', 
                        value: data.event.friendlyName,
                        inline: true 
                    },
                    { 
                        name: '⏱️ Duración Restante', 
                        value: data.timing.remainingDuration || 'Hasta finalización',
                        inline: true 
                    },
                    { 
                        name: '🛤️ Líneas Afectadas', 
                        value: affectedLines || 'Todas las líneas principales',
                        inline: false 
                    }
                )
                .setFooter({ 
                    text: `🔄 Actualizado: ${this.timeHelpers.formatDateTime(new Date())}` 
                })
                .setThumbnail('https://i.imgur.com/4jK7h9E.png');

            await this._sendSafeEmbed(embed, 'express');
        } catch (error) {
            logger.error('[AnnouncementHandler] Failed to send express update', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async sendServiceChange(data) {
        try {
            const isOpening = data.isOpening;
            const isExtended = data.type === 'extended';
            const dayType = this._getFriendlyDayType(data.dayType);

            const embed = new EmbedBuilder()
                .setTitle(isOpening ? '🚇 Servicio Iniciado' : '🚇 Servicio Finalizado')
                .setColor(isOpening ? '#00FF00' : '#FF0000')
                .setDescription(isOpening
                    ? `**¡El servicio de metro está ahora ${isExtended ? 'con horario extendido' : 'operativo'}!**\nHorario de ${dayType} en efecto.`
                    : `**El servicio de metro ha finalizado por hoy.**\nReabriremos mañana a las ${data.systemState.nextTransition.time}.`)
                .addFields(
                    { 
                        name: '⏳ Horario Actual', 
                        value: data.systemState.period,
                        inline: true 
                    },
                    { 
                        name: '🔄 Próximo Cambio', 
                        value: data.systemState.nextTransition?.time || 'No programado',
                        inline: true 
                    },
                    { 
                        name: '📅 Tipo de Día', 
                        value: dayType,
                        inline: true 
                    }
                )
                .setFooter({ 
                    text: `⏰ ${isOpening ? 'Iniciado' : 'Finalizado'} el ${this.timeHelpers.formatDateTime(new Date())}` 
                })
                .setThumbnail(isOpening ? 'https://i.imgur.com/7W2jK3T.png' : 'https://i.imgur.com/9QZ7J3c.png');

            await this._sendSafeEmbed(embed, 'service');
        } catch (error) {
            logger.error('[AnnouncementHandler] Failed to send service change', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /* ====================== */
    /*  UTILITY METHODS       */
    /* ====================== */

    _calculateRemainingExpressDuration(payload) {
        const now = this.timeHelpers.currentTime;
        const endTime = payload.data.period.end || '19:30';
        const duration = moment(endTime, 'HH:mm').diff(now);
        
        if (duration <= 0) return 'Menos de 1 minuto';
        return this.timeHelpers.formatDuration(duration);
    }

    _getDefaultAffectedLines() {
        return ['L1', 'L2', 'L5'];
    }

    _sanitizePayloadForLogging(payload) {
        try {
            return {
                type: payload.type,
                timestamp: payload.timestamp,
                metadata: payload.metadata,
                data: Object.keys(payload.data || {}).reduce((acc, key) => {
                    acc[key] = typeof payload.data[key] === 'object' ? '[Object]' : payload.data[key];
                    return acc;
                }, {})
            };
        } catch (e) {
            return '[Unable to sanitize payload]';
        }
    }

    /* ====================== */
    /*  ORIGINAL METHODS      */
    /* ====================== */

    enableDebugMode() {
        logger.debug('[AnnouncementHandler] Enabling debug mode');
        this.manager.enableDebugMode();
        return this;
    }

    async processChangeMessages(messages, severity) {
        try {
            logger.debug('[AnnouncementHandler] Processing change messages', {
                messageCount: messages.length,
                severity
            });
            await this.manager.processChangeMessages(messages, severity);
        } catch (error) {
            logger.error('[AnnouncementHandler] Failed to process change messages', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async sendEventAnnouncement(data) {
        try {
            logger.debug('[AnnouncementHandler] Sending event announcement');
            await this.manager.sendEventAnnouncement(data);
        } catch (error) {
            logger.error('[AnnouncementHandler] Failed to send event announcement', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async generateMessages(changes, allStations) {
        try {
            logger.debug('[AnnouncementHandler] Generating announcement messages', {
                changesCount: changes?.changes?.length,
                hasAllStations: !!allStations
            });

            if (!allStations) {
                logger.warn('[AnnouncementHandler] No allStations provided, using metroCore data');
                allStations = this.parent.metroCore.getCurrentData();
            }

            const embeds = await this.announcer.generateMessages(changes, allStations);
            logger.debug('[AnnouncementHandler] Generated embed messages', {
                count: embeds.length
            });
            
            await this.manager.processChangeMessages(embeds, 'medium');
            return embeds;
        } catch (error) {
            logger.error('[AnnouncementHandler] Failed to generate messages', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async sendEmbed(embed, severity = 'medium') {
        try {
            logger.debug('[AnnouncementHandler] Sending direct embed');
            await this.manager._sendSafeEmbed(embed, 'system', severity);
        } catch (error) {
            logger.error('[AnnouncementHandler] Failed to send embed', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
    
    _getLineDisplayName(lineId) {
        return this.announcer._getLineDisplayName(lineId);
    }

    _getStationDisplayName(stationId) {
        return this.announcer._getStationDisplayName(stationId);
    }
}

module.exports = AnnouncementHandler;