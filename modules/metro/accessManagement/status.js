const AccessCore = require('./accessCore');
const { EmbedBuilder } = require('discord.js');

class StatusHandler extends AccessCore {
    constructor() {
        super();
    }

    async handle(message, args) {
        const parsedArgs = this.parseQuotedArgs(args);
        const rawName = parsedArgs[0];
        const rawLine = parsedArgs[1];
        const elementType = parsedArgs[2]?.toLowerCase();
        const elementId = parsedArgs[3];
        const statusParts = parsedArgs.slice(4);
        
        if (!rawName || !rawLine || !elementType || !elementId || statusParts.length === 0) {
            return this.sendError(message, 
                'Formato incorrecto. Uso: m!stationaccess estado "Estación" línea tipo id "estado"\n' +
                'Ejemplo: m!stationaccess estado "Baquedano" l1 ascensor A "fuera de servicio"'
            );
        }

        const validStatuses = ['abierto', 'cerrado', 'operativa', 'fuera de servicio', 'mantención'];
        const status = statusParts.join(' ').toLowerCase();
        
        if (!validStatuses.includes(status)) {
            return this.sendError(message, 
                `Estado inválido. Usar uno de: ${validStatuses.join(', ')}`
            );
        }

        const stationKey = this.normalizeKey(`${rawName} ${rawLine}`);
        const config = await this.getAccessConfig(stationKey);

        if (!config) {
            return this.sendError(message, 
                `La estación ${rawName} ${rawLine} no tiene configuración. Usa primero "configurar".`
            );
        }

        let element, elementTypePlural;
        switch (elementType) {
            case 'ascensor':
                element = config.elevators.find(e => e.id.toLowerCase() === elementId.toLowerCase());
                elementTypePlural = 'ascensores';
                break;
            case 'escalera':
                element = config.escalators.find(e => e.id.toLowerCase() === elementId.toLowerCase());
                elementTypePlural = 'escaleras';
                break;
            case 'acceso':
                element = config.accesses.find(a => a.id.toLowerCase() === elementId.toLowerCase());
                elementTypePlural = 'accesos';
                break;
            default:
                return this.sendError(message, 
                    'Tipo de elemento inválido. Usar "ascensor", "escalera" o "acceso".'
                );
        }

        if (!element) {
            const availableElements = (elementType === 'ascensor' ? config.elevators : 
                                    elementType === 'escalera' ? config.escalators : config.accesses)
                                   .map(e => e.id).join(', ') || 'Ninguno';
            
            return this.sendError(message, 
                `No se encontró ${elementType} con ID ${elementId}.\n` +
                `${elementTypePlural} disponibles: ${availableElements}`
            );
        }

        const timestamp = new Date().toISOString();
        const oldStatus = element.status || (elementType === 'acceso' ? 'abierto' : 'operativa');

        // Update status and timestamps
        element.status = status;
        element.lastUpdated = timestamp;
        config.lastUpdated = timestamp;

        // Add to change history
        config.changeHistory.push({
            timestamp,
            user: message.author.tag,
            action: `Actualización de estado`,
            details: `${elementType} ${elementId}: ${oldStatus} → ${status}`
        });

        // Save changes
        await this.saveAccessConfig(stationKey, config);
        await this.updateMainAccessibilityStatus(rawName, rawLine, config);

        // Create response embed
        const embed = new EmbedBuilder()
            .setColor(status.includes('cerrado') || status.includes('fuera de servicio') ? 0xFF0000 : 0x00FF00)
            .setTitle(`✅ Estado actualizado: ${rawName} ${rawLine}`)
            .addFields(
                { name: 'Elemento', value: `${elementType} ${elementId}`, inline: true },
                { name: 'Estado anterior', value: oldStatus, inline: true },
                { name: 'Nuevo estado', value: status, inline: true },
                { 
                    name: elementType === 'acceso' ? 'Ubicación' : 'Ruta', 
                    value: element.fullPath || element.name || `${element.from} → ${element.to}`, 
                    inline: false 
                }
            )
            .setFooter({ 
                text: `Actualizado el ${new Date(timestamp).toLocaleString('es-CL')}` 
            });

        return message.reply({ embeds: [embed] });
    }
}

module.exports = StatusHandler;