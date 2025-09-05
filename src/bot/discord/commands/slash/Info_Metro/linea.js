const { SlashCommandBuilder } = require('discord.js');
const BaseCommand = require('../../BaseCommand');
const estado = require('./_linestado');
const info = require('./_lininfo');
const proyecto = require('./_linproyecto');

class LineaCommand extends BaseCommand {
    constructor() {
        super(new SlashCommandBuilder()
            .setName('linea')
            .setDescription('Información de una línea')
        );
        this.category = "Metro Info";

        this.addSubcommand(estado);
        this.addSubcommand(info);
        this.addSubcommand(proyecto);
    }
}

module.exports = new LineaCommand();