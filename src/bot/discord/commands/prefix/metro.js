const BaseCommand = require('../BaseCommand');
const MetroSystem = require('../../../../core/metro/MetroSystem');

class MetroCommand extends BaseCommand {
    constructor() {
        super({
            name: 'metro',
            description: 'Sistema de información y reportes del metro.',
        });

        this.subcommands = new Map([
            ['all', this.handleAll],
            ['station', this.handleStation],
            ['line', this.handleLine],
            ['status', this.handleStatus],
            ['help', this.showHelp],
        ]);
    }

    async run(message) {
        const args = message.content.slice(config.prefix.length).trim().split(/ +/);
        args.shift();
        const subcommandName = args[0]?.toLowerCase() || 'help';
        const subArgs = args.slice(1);
        const subcommand = this.subcommands.get(subcommandName) || this.showHelp;

        const system = new MetroSystem();
        await system.initialize();

        await subcommand.call(this, system, message, subArgs);
    }

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
    }

    async handleStation(system, message, args) {
        const embed = await system.handleStationCommand(args);
        await message.channel.send({ embeds: [embed] });
    }

    async handleLine(system, message, args) {
        const embed = await system.handleLineCommand(args);
        await message.channel.send({ embeds: [embed] });
    }

    async handleStatus(system, message) {
        const status = await system.getSystemStatus();
        const embed = system.generateStatusReport(status);
        await message.channel.send({ embeds: [embed] });
    }

    showHelp(system, message) {
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
}

module.exports = new MetroCommand();