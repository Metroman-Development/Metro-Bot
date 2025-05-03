const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const path = require('path');

// Import the handlers properly
const AccessCore = require('../modules/metro/accessManagement/accessCore');
const ConfigureHandler = require('../modules/metro/accessManagement/configure');
const StatusHandler = require('../modules/metro/accessManagement/status' );
const ViewHandler = require('../modules/metro/accessManagement/view');
const ListHandler = require('../modules/metro/accessManagement/list');
const HistoryHandler = require('../modules/metro/accessManagement/history');

// Initialize handlers with proper error handling
const handlers = {
    config: new ConfigureHandler(),
    status: new StatusHandler(),
    view: new ViewHandler(),
    list: new ListHandler(),
    history: new HistoryHandler()
};

// Verify all handlers are properly initialized
for (const [name, handler] of Object.entries(handlers)) {
    if (!handler || typeof handler.handle !== 'function') {
        console.error(`Error: ${name}Handler not properly initialized`);
        // Provide fallback implementation
        handlers[name] = {
            handle: () => Promise.reject(new Error(`${name} functionality not available`))
        };
    }
}

module.exports = {
    name: 'stationaccess',
    description: '🛗 Sistema avanzado de gestión de infraestructura de accesibilidad',
    usage: 'm!stationaccess <acción> [estación] [línea] [opciones]\n' +
           'Acciones:\n' +
           '- configurar: Crea/edita la configuración de accesibilidad\n' +
           '- estado: Actualiza el estado de un elemento\n' +
           '- ver: Muestra el estado actual\n' +
           '- listar: Lista estaciones con problemas\n' +
           '- historial: Muestra el historial de cambios\n' +
           '- aedit: Edición avanzada (modificación masiva)\n' +
           '- replace: Reemplazo masivo de valores',
    aliases: ['access', 'estacion-accesibilidad'],
    category: 'admin',
    cooldown: 5,
    permissions: [PermissionsBitField.Flags.Administrator],

    async execute(message, args) {
        try {
            // Check permissions
            if (!message.member.permissions.has(this.permissions)) {
                return message.reply('🔒 Necesitas permisos de administrador.');
            }

            const [action, ...restArgs] = args;
            if (!action) return this.showHelp(message);

            // Handle actions
            switch (action.toLowerCase()) {
                case 'configurar':
                case 'configure':
                    return handlers.config.handle(message, restArgs)
                        .catch(err => this.handleError(message, err, 'configurar'));

                case 'estado':
                case 'status':
                    return handlers.status.handle(message, restArgs)
                        .catch(err => this.handleError(message, err, 'actualizar estado'));

                case 'ver':
                case 'view':
                    return handlers.view.handle(message, restArgs)
                        .catch(err => this.handleError(message, err, 'mostrar información'));

                case 'listar':
                case 'list':
                    return handlers.list.handle(message, restArgs)
                        .catch(err => this.handleError(message, err, 'listar estaciones'));

                case 'historial':
                case 'history':
                    return handlers.history.handle(message, restArgs)
                        .catch(err => this.handleError(message, err, 'mostrar historial'));

                case 'aedit':
                case 'advancededit':
                    return handlers.config.handle(message, ['aedit', ...restArgs])
                        .catch(err => this.handleError(message, err, 'edición avanzada'));

                case 'replace':
                    return handlers.config.handle(message, ['replace', ...restArgs])
                        .catch(err => this.handleError(message, err, 'reemplazo masivo'));

                case 'ayuda':
                case 'help':
                    return this.showHelp(message);

                default:
                    return this.showHelp(message);
            }
        } catch (error) {
            return this.handleError(message, error, 'ejecutar comando');
        }
    },

    handleError(message, error, action) {
        console.error(`[StationAccess Error] Error al ${action}:`, error);
        const errorMessage = error.message.includes('not available') ? 
            'Funcionalidad no disponible temporalmente' : 
            `Error al ${action}: ${error.message}`;
        
        return message.reply({
            embeds: [new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription(`❌ ${errorMessage}`)
            ]
        });
    },

    showHelp(message) {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🛗 Ayuda de Gestión de Accesibilidad')
            .setDescription(this.usage)
            .addFields(
                { name: '📝 Ejemplos', value: 
                    '```\n' +
                    'm!stationaccess configurar "Estación Ejemplo" L1\n' +
                    'm!stationaccess estado "Baquedano" L1 ascensor A1 "fuera de servicio"\n' +
                    'm!stationaccess ver "Los Héroes" L2\n' +
                    '```'
                }
            );

        return message.reply({ embeds: [helpEmbed] });
    }
};
