



const { SlashCommandBuilder } = require('discord.js');
const BaseCommand = require('../../BaseCommand');
const calendarioSemana = require('./_mesemana');
const calendarioMes = require('./_memes');
const calendarioEventos = require('./_meeventos');

class CalendarioMetroCommand extends BaseCommand {
    constructor() {
        super(new SlashCommandBuilder()
            .setName('calendario-metro')
            .setDescription('Información de calendario del Metro')
        );
        this.category = "Metro Calendar";

        this.addSubcommand(calendarioSemana);
        this.addSubcommand(calendarioMes);
        this.addSubcommand(calendarioEventos);
    }
}

module.exports = new CalendarioMetroCommand();



