const AccessCore = require('./accessCore');
const { EmbedBuilder } = require('discord.js');

class ViewHandler extends AccessCore {
    constructor() {
        super();
    }

    async handle(message, args) {
        const parsedArgs = this.parseQuotedArgs(args);
        const rawName = parsedArgs[0];
        const rawLine = parsedArgs[1];
        
        if (!rawName || !rawLine) {
            return this.sendError(message, 
                'Debes especificar nombre de estación y línea (ej: "San Pablo" l1)\n' +
                'Uso: m!stationaccess ver "Nombre Estación" línea'
            );
        }

        const stationKey = this.normalizeKey(`${rawName.replace(" ", "-").toLowerCase() }-${rawLine}`);
        const config = await this.getAccessConfig(stationKey);

        if (!config) {
            return this.sendError(message, 
                `La estación ${rawName} ${rawLine} no tiene configuración.\n` +
                'Usa primero: m!stationaccess configurar "Nombre Estación" línea'
            );
        }

        return this.displayStationStatus(message, config);
    }

    async displayStationStatus(message, config) {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`🛗 Estado de accesibilidad: ${config.station} ${config.line}`)
            .setDescription(`Última actualización: ${new Date(config.lastUpdated).toLocaleString('es-CL')}`)
            .setThumbnail('https://i.imgur.com/7W6mJ4t.png'); // Metro accessibility icon

        // Add Elevators section if they exist
        if (config.elevators.length > 0) {
            embed.addFields({
                name: `Ascensores (${config.elevators.length})`,
                value: config.elevators.map(e => 
                    this.formatElementStatus(e, '🛗')
                ).join('\n'),
                inline: false
            });
        }

        // Add Escalators section if they exist
        if (config.escalators.length > 0) {
            embed.addFields({
                name: `Escaleras Mecánicas (${config.escalators.length})`,
                value: config.escalators.map(e => 
                    this.formatElementStatus(e, '🔼')
                ).join('\n'),
                inline: false
            });
        }

        // Add Access Points section if they exist
        if (config.accesses.length > 0) {
            embed.addFields({
                name: `Accesos (${config.accesses.length})`,
                value: config.accesses.map(a => 
                    this.formatAccessStatus(a)
                ).join('\n'),
                inline: false
            });
        }

        // Add warning if no accessibility elements exist
        if (config.elevators.length === 0 && config.escalators.length === 0) {
            embed.addFields({
                name: '⚠️ Advertencia',
                value: 'Esta estación no tiene elementos de accesibilidad registrados',
                inline: false
            });
        }

        return message.reply({ embeds: [embed] });
    }

    formatElementStatus(element, emoji) {
        const statusIcon = element.status.includes('fuera de servicio') || 
                          element.status.includes('cerrado') || 
                          element.status.includes('mantención') ? '🔴' : '🟢';
        
        return `${statusIcon} ${emoji} **${element.id}**: ` +
               `${element.fullPath || `${element.from} → ${element.to}`} - ` +
               `_${element.status}_` +
               (element.notes ? `\n📝 ${element.notes}` : '');
    }

    formatAccessStatus(access) {
        const statusIcon = access.status === 'cerrado' ? '🔴' : '🟢';
        
        return `${statusIcon} 🚪 **${access.id}**: ${access.name}` +
               (access.description ? ` (${access.description})` : '') +
               ` - _${access.status || 'abierto'}_` +
               (access.notes ? `\n📝 ${access.notes}` : '');
    }
}

module.exports = ViewHandler;