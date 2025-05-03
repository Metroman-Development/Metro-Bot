// modules/metro/core/services/DiscordAnnouncementService.js
// modules/metro/core/services/DiscordAnnouncementService.js
// modules/metro/core/services/DiscordBotService.js
// modules/metro/core/services/DiscordBotService.js
const { EmbedBuilder } = require('discord.js');
const logger = require('../../../../events/logger');
const clientManager = require('../../../../utils/clientManager');
const styles = require('../../../../config/metro/styles.json');
const metroConfig = require('../../../../config/metro/metroConfig');

class DiscordBotService {
    constructor() {
        this.channelId = metroConfig.announcementChannelId;
        this.client = null;
        this.ready = false;
        this.config = {
            colors: {
                success: styles.defaultTheme.successColor,
                error: styles.defaultTheme.errorColor,
                warning: styles.defaultTheme.warningColor,
                info: styles.defaultTheme.infoColor
            },
            icons: {
                metro: metroConfig.metroLogo.principal,
                transfer: metroConfig.stationIcons[1].emoji,
                express: metroConfig.linesEmojis.l2, // Using line 2 emoji as default express
                access: metroConfig.accessCards.bip
            }
        };
    }

    async initialize() {
        if (this.ready) return;
        
        try {
            this.client = await clientManager.getClient('discord');
            this.ready = true;
            logger.info('[DiscordBot] Cliente listo para enviar mensajes');
        } catch (error) {
            logger.error('[DiscordBot] Error al inicializar el cliente', error);
            throw error;
        }
    }

    async sendOverrideChange(change) {
        if (!this.ready) {
            await this.initialize();
        }

        try {
            const channel = await this.client.channels.fetch(this.channelId);
            if (!channel) {
                throw new Error(`Canal ${this.channelId} no encontrado`);
            }

            const embed = this._createSpanishEmbed(change);
            await channel.send({ embeds: [embed] });
            
            logger.debug(`[DiscordBot] Notificación enviada: ${change.type}`);
            return true;
        } catch (error) {
            logger.error('[DiscordBot] Error al enviar mensaje', {
                error: error.message,
                change,
                stack: error.stack
            });
            return false;
        }
    }

    _createSpanishEmbed(change) {
        const embed = new EmbedBuilder();
        
        // Configuración base en español
        embed.setColor(this._getColorForChange(change))
             .setTimestamp()
             .setFooter({ 
                 text: 'Sistema de Metro - Actualización Automática',
                 iconURL: this.config.icons.metro 
             });

        // Personalización por tipo de cambio
        switch(change.type) {
            case 'isTransferOperational':
                this._configureTransferEmbed(embed, change);
                break;
            case 'expressSupressed':
                this._configureExpressEmbed(embed, change);
                break;
            case 'accessPointsOperational':
                this._configureAccessEmbed(embed, change);
                break;
            default:
                this._configureDefaultEmbed(embed, change);
        }

        return embed;
    }

    _configureTransferEmbed(embed, change) {
        const status = change.newState ? 'OPERATIVAS' : 'INOPERATIVAS';
        const lines = this._formatLines(change.connectedLines || [change.lineId]);

        embed.setTitle(`🔄 CAMBIO EN TRANSFERENCIAS - ${status}`)
            .setDescription([
                `**Estación:** ${change.stationCode.toUpperCase()}`,
                `**Líneas conectadas:** ${lines}`,
                `**Actualizado:** <t:${Math.floor(new Date(change.timestamp).getTime())/1000}:R>}`
            ].join('\n'))
            .addFields(
                {
                    name: 'Estado Anterior',
                    value: change.previousState ? '✅ Operativas' : '❌ Inoperativas',
                    inline: true
                },
                {
                    name: 'Nuevo Estado',
                    value: change.newState ? '✅ Operativas' : '❌ Inoperativas',
                    inline: true
                }
            )
            //.setThumbnail(this.config.icons.transfer);
    }

    _configureExpressEmbed(embed, change) {
        embed.setTitle(`🚆 SERVICIO EXPRESO ${change.newState ? 'ACTIVADO' : 'DESACTIVADO'}`)
            .setDescription(`Cambio en la Línea ${change.lineId.replace('l', '')}`)
            .addFields(
                {
                    name: 'Estado Anterior',
                    value: change.previousState ? '✅ Activo' : '❌ Inactivo',
                    inline: true
                },
                {
                    name: 'Nuevo Estado',
                    value: change.newState ? '✅ Activo' : '❌ Inactivo',
                    inline: true
                },
                {
                    name: 'Hora del Cambio',
                    value: `<t:${Math.floor(new Date(change.timestamp).getTime())/1000}:t>}`,
                    inline: false
                }
            )
            .setThumbnail(this.config.icons.express);
    }

    _configureAccessEmbed(embed, change) {
        embed.setTitle(`🚪 ACCESOS ${change.newState ? 'HABILITADOS' : 'RESTRINGIDOS'}`)
            .setDescription([
                `**Estación:** ${change.stationCode.toUpperCase()}`,
                `**Línea:** ${change.lineId.replace('l', '')}`
            ].join('\n'))
            .addFields(
                {
                    name: 'Estado Anterior',
                    value: change.previousState ? '✅ Habilitados' : '❌ Restringidos',
                    inline: true
                },
                {
                    name: 'Nuevo Estado',
                    value: change.newState ? '✅ Habilitados' : '❌ Restringidos',
                    inline: true
                },
                {
                    name: 'Última Actualización',
                    value: `<t:${Math.floor(new Date(change.timestamp).getTime())/1000}:f>}`,
                    inline: false
                }
            )
            .setThumbnail(this.config.icons.access);
    }

    _configureDefaultEmbed(embed, change) {
        embed.setTitle('⚠️ CAMBIO EN CONFIGURACIÓN')
            .setDescription(this._getChangeDescription(change))
            .addFields(
                {
                    name: 'Tipo de Cambio',
                    value: this._getChangeTypeSpanish(change.type),
                    inline: true
                },
                {
                    name: 'Estado Anterior',
                    value: change.previousState ? '✅ Activo' : '❌ Inactivo',
                    inline: true
                },
                {
                    name: 'Nuevo Estado',
                    value: change.newState ? '✅ Activo' : '❌ Inactivo',
                    inline: true
                },
                {
                    name: 'Ubicación',
                    value: this._getLocationString(change),
                    inline: false
                }
            );
    }

    _getColorForChange(change) {
        return change.newState ? this.config.colors.success : this.config.colors.error;
    }

    _formatLines(lineIds) {
        return lineIds.map(id => `Línea ${id.replace('l', '')}`).join(' ↔ ');
    }

    _getChangeDescription(change) {
        const descriptions = {
            'isTransferOperational': `Estado de transferencias modificado en ${change.stationCode.toUpperCase()}`,
            'expressSupressed': `Servicio expreso modificado en Línea ${change.lineId.replace('l', '')}`,
            'accessPointsOperational': `Estado de accesos modificado en ${change.stationCode.toUpperCase()}`,
            'default': 'Cambio de configuración detectado'
        };
        return descriptions[change.type] || descriptions.default;
    }

    _getChangeTypeSpanish(type) {
        const types = {
            'isTransferOperational': 'Transferencias',
            'expressSupressed': 'Servicio Expreso',
            'accessPointsOperational': 'Accesos'
        };
        return types[type] || 'Configuración';
    }

    _getLocationString(change) {
        if (change.type === 'expressSupressed') {
            return `Línea ${change.lineId.replace('l', '')}`;
        }
        
        if (change.stationCode) {
            const lineText = change.lineId ? ` (Línea ${change.lineId.replace('l', '')})` : '';
            return `Estación ${change.stationCode.toUpperCase()}${lineText}`;
        }
        
        return 'Sistema Global';
    }

    async cleanup() {
        try {
            if (this.client) {
                this.client.removeAllListeners();
                this.ready = false;
            }
            logger.info('[DiscordBot] Servicio limpiado correctamente');
        } catch (error) {
            logger.error('[DiscordBot] Error en limpieza', error);
        }
    }
}

module.exports = DiscordBotService;
