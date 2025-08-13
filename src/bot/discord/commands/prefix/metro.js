const MetroSystem = require('../../../../core/metro/MetroSystem');

/**
 * @file Prefix command for interacting with the Metro system.
 * @description This command provides various subcommands to get information and reports about the Metro system.
 */
module.exports = {
    name: 'metro',
    description: 'Sistema de información y reportes del metro.',
    
    /**
     * Executes the main metro command or one of its subcommands.
     * @param {import('discord.js').Message} message The message object that triggered the command.
     * @param {Array<string>} args The arguments passed to the command.
     */
    async execute(message, args) {
        const subcommand = args.length > 0 ? args[0].toLowerCase() : 'help';
        const remainingArgs = args.slice(1);
        
        const system = new MetroSystem();

        try {
            await system.initialize();

            switch (subcommand) {
                case 'all':
                    await this.handleAll(system, message);
                    break;
                case 'station':
                    await this.handleStation(system, message, remainingArgs);
                    break;
                case 'line':
                    await this.handleLine(system, message, remainingArgs);
                    break;
                case 'status':
                    await this.handleStatus(system, message);
                    break;
                case 'help':
                default:
                    this.showHelp(message);
                    break;
            }
        } catch (error) {
            console.error(`Error executing 'metro ${subcommand}' command:`, error);
            message.channel.send('❌ Ocurrió un error al procesar tu solicitud. Por favor, inténtalo de nuevo.');
        }
    },

    /**
     * Handles the 'all' subcommand.
     * @param {MetroSystem} system The MetroSystem instance.
     * @param {import('discord.js').Message} message The message object.
     */
    async handleAll(system, message) {
        const [stations, lines, status] = await Promise.all([
            system.verifyCriticalStations(),
            system.verifyLines(),
            system.getSystemStatus()
        ]);

        await message.channel.send({
            embeds: [
                system.generateStatusReport(status),
                system.generateLineReport(lines),
                system.generateStationReport(stations)
            ]
        });
    },

    /**
     * Handles the 'station' subcommand.
     * @param {MetroSystem} system The MetroSystem instance.
     * @param {import('discord.js').Message} message The message object.
     * @param {Array<string>} args The arguments for the subcommand.
     */
    async handleStation(system, message, args) {
        const embed = await system.handleStationCommand(args);
        await message.channel.send({ embeds: [embed] });
    },

    /**
     * Handles the 'line' subcommand.
     * @param {MetroSystem} system The MetroSystem instance.
     * @param {import('discord.js').Message} message The message object.
     * @param {Array<string>} args The arguments for the subcommand.
     */
    async handleLine(system, message, args) {
        const embed = await system.handleLineCommand(args);
        await message.channel.send({ embeds: [embed] });
    },

    /**
     * Handles the 'status' subcommand.
     * @param {MetroSystem} system The MetroSystem instance.
     * @param {import('discord.js').Message} message The message object.
     */
    async handleStatus(system, message) {
        const status = await system.getSystemStatus();
        const embed = system.generateStatusReport(status);
        await message.channel.send({ embeds: [embed] });
    },

    /**
     * Displays the help message for the metro command.
     * @param {import('discord.js').Message} message The message object.
     */
    showHelp(message) {
        const helpMessage = [
            '**Sistema de Información Metro**',
            'Subcomandos disponibles:',
            '`!metro all` - Reporte completo del sistema.',
            '`!metro station <nombre>` - Busca información sobre una estación específica.',
            '`!metro line <línea>` - Muestra información sobre una línea específica.',
            '`!metro status` - Proporciona el estado operacional general del sistema.'
        ].join('\n');
        message.channel.send(helpMessage);
    }
};