const { SlashCommandBuilder } = require('discord.js');
const BaseCommand = require('../../BaseCommand');
const actual = require('./_mtactual');
const horarios = require('./_mthorarios');
const diferenciada = require('./_mtdiferenciada');
const version = require('./_mtver');

class ServicioMetroCommand extends BaseCommand {
    constructor() {
        super(new SlashCommandBuilder()
            .setName('servicio-metro')
            .setDescription('Información sobre el servicio de Metro')
        );
        this.category = "Metro Info";

        this.addSubcommand(actual);
        this.addSubcommand(horarios);
        this.addSubcommand(diferenciada);
        this.addSubcommand(version);
    }
}

module.exports = new ServicioMetroCommand();
