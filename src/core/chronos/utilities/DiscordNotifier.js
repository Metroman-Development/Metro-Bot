const { EmbedBuilder } = require('discord.js');
const TimeHelpers = require('../timeHelpers');
  
// Add this to _initializeMetroCoreListeners()


// Add this new handler method


const logger = require('../../../events/logger');

class DiscordNotifier {
    constructor(client, metro) {
        this.client = client;
        this.metro = metro;
        this.time = TimeHelpers;
        this.channels = {
            announcements: '1347146518943105085',
            logs: '1350243847271092295'
        };
        
        this.pending = {
            embeds: [],
            timeout: null
        };

        // Track recently sent events to prevent duplicates
        this.sentEvents = new Map();
        
        // Initialize MetroCore listeners
        this._initializeMetroCoreListeners();
    }

    // ██████████████████████████████████████████████████████████████████████
    // METROCORE INTEGRATION
    // ██████████████████████████████████████████████████████████████████████

    _initializeMetroCoreListeners() {
        if (!this.client.metroCore) {
            logger.error('MetroCore not available in DiscordNotifier');
            return;
        }

        // Service changes
        
        this.metro.on('farePeriodTransition', (data) => {

    this._handleFarePeriodChange(data);

});
        this.metro.on('serviceChange', (data) => {
            const type = data.type.includes('start') ? 'serviceStart' : 'serviceEnd';
            this._handleServiceChange(type, data);
        });

        // Express service updates
        this.metro.on('expressServiceUpdate', (data) => {
            this._handleExpressUpdate(data);
        });

        // Special events
        this.metro.on('specialEvent', (data) => {
            this._handleSpecialEvent(data);
        });

        logger.debug('Initialized MetroCore listeners in DiscordNotifier');
    }

    // ██████████████████████████████████████████████████████████████████████
    // EVENT HANDLERS
    // ██████████████████████████████████████████████████████████████████████

    _handleServiceChange(type, data) {
        const embed = this._createServiceEmbed(type, data);
        this._queueEmbed(embed);
    }

    _handleExpressUpdate(data) {
        const embed = this._createExpressEmbed(data);
        this._queueEmbed(embed);
    }

    _handleSpecialEvent(data) {
        const embed = this._createEventEmbed(data);
        this._queueEmbed(embed);
    }

    _handleFarePeriodChange(data) {

    const isStart = data.type === 'peak_start';

    const embed = new EmbedBuilder()

        .setColor(isStart ? 0xFFA500 : 0x3498DB)

        .setTitle(isStart ? '🚨 Hora Punta Iniciada' : '✅ Hora Punta Finalizada')

        .addFields(

            { name: '⏰ Periodo', value: `${data.period.start} - ${data.period.end}`, inline: true },

            { name: '💰 Tarifa', value: isStart ? 'Aplicando tarifa punta' : 'Volviendo a tarifa normal', inline: true }

        )

        .setFooter({ text: 'Los precios de los pasajes pueden variar durante este periodo' });

    

    this._queueEmbed(embed);

}
    // ██████████████████████████████████████████████████████████████████████
    // EMBED CREATION
    // ██████████████████████████████████████████████████████████████████████

    _createServiceEmbed(type, data) {
        const operatingHours = this.time.getOperatingHours();
        const currentEvent = this.time.getEventDetails();
        
        const embed = new EmbedBuilder()
            .setColor(type === 'serviceStart' ? 0x00FF00 : 0xFF0000)
            .setTitle(type === 'serviceStart' ? '🌄 El Servicio de Metro de Santiago ha Comenzado' : '🌉 Está Finalizando el Servicio de Metro de Santiago ')
            .addFields(
                { name: '📅 Día', value: this.time.currentDay, inline: true },
                { name: '⏰ Horario', value: `${operatingHours.opening} - ${operatingHours.closing}`, inline: true }
            );

        if (type === 'serviceStart' && currentEvent) {
            embed.addFields(
                { name: '🎪 Extensión Horaria', value: `${currentEvent.name} hasta las ${operatingHours.extension[1]} `},
               // { name: '🔧 Impact', value: currentEvent.notes || 'None' }
            );
        }

        if (type === 'serviceEnd') {
            embed.addFields(
                { name: '🔜 Próxima Apertura', value: this.time.getNextTransition().message, 
                  name: '🎪 Recordatorio: Extensión Horaria', value: `${currentEvent.name} hasta las ${operatingHours.extension[1]} `} 
             
                
            );
        }

        return embed;
    }

    _createExpressEmbed(data) {
        return new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('🚄 Actualización Ruta Expresa')
            .addFields(
                { name: '⏱️ Periodo', value: data.context.period, inline: true },
                { name: '🚈 Líneas', value: data.context.affectedLines.join(', '), inline: true }, 
                { name: '🕒 Horario', value: `${data.context.startTime} - ${data.context.endTime}` }
            );
    }

    _createEventEmbed(data) {
        return new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('🎉 Notificación de Evento')
            .addFields(
                { name: '📌 Evento', value: data.type, inline: true },
                { name: '🕒 Horario', value: new Date(data.effective).toLocaleString(), inline: true },
                { name: '🌙 Extensión Horaria', value: data.impact.affectedLines?.join(', ') || 'None' }
            )
            .setDescription(`Impact Level: ${data.impact.level}`);
    }

    // ██████████████████████████████████████████████████████████████████████
    // QUEUE MANAGEMENT
    // ██████████████████████████████████████████████████████████████████████

    _queueEmbed(embed) {
        // Create a unique key for this event
        const eventKey = this._getEmbedKey(embed);
        
        // Check for duplicate events
        if (this.sentEvents.has(eventKey)) {
            logger.debug(`Skipping duplicate event: ${eventKey}`);
            return;
        }
        
        // Mark event as sent
        this.sentEvents.set(eventKey, true);
        
        // Clear event from tracking after 1 hour
        setTimeout(() => {
            this.sentEvents.delete(eventKey);
        }, 60 * 60 * 1000);
        
        this.pending.embeds.push(embed);
        
        if (!this.pending.timeout) {
            this.pending.timeout = setTimeout(() => {
                this._sendBatch();
            }, 500);
        }
    }

    _getEmbedKey(embed) {
        // Create a unique identifier based on embed content
        const title = embed.data.title;
        const fields = embed.data.fields?.map(f => `${f.name}:${f.value}`).join('|') || '';
        return `${title}|${fields}`;
    }

    async _sendBatch() {
        if (this.pending.embeds.length === 0) return;
        
        try {
            const channel = await this.client.channels.fetch(this.channels.announcements);
            if (!channel) throw new Error('Announcement channel not found');
            
            // Split into batches of 10 (Discord limit)
            const batches = [];
            while (this.pending.embeds.length > 0) {
                batches.push(this.pending.embeds.splice(0, 10));
            }
            
            for (const batch of batches) {
                await channel.send({ embeds: batch });
            }
            
            logger.info(`Sent ${batches.flat().length} batched notifications`);
            
        } catch (error) {
            logger.error('Failed to send notification batch:', error);
            // Fallback to log channel
            if (this.channels.logs) {
                await this._sendToLogChannel(error);
            }
        } finally {
            this.pending.timeout = null;
        }
    }

    async _sendToLogChannel(error) {
        try {
            const logChannel = await this.client.channels.fetch(this.channels.logs);
            if (logChannel) {
                await logChannel.send({
                    content: `⚠️ Failed to send notifications: ${error.message}`,
                    embeds: this.pending.embeds
                });
            }
        } catch (logError) {
            logger.error('Failed to send to log channel:', logError);
        }
    }
}

module.exports = DiscordNotifier;