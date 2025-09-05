const { SlashCommandBuilder } = require('discord.js');
const BaseCommand = require('../../BaseCommand');
const comercio = require('./_buscarcomercio');
const bici = require('./_buscarcicletero');
const cultura = require('./_buscarcultura');
const access = require('./_buscaraccesibilidad');

class BuscarCommand extends BaseCommand {
    constructor() {
        super(new SlashCommandBuilder()
            .setName('buscar')
            .setDescription('Buscar información en el sistema Metro')
        );
        this.category = "Metro Info";

        this.addSubcommand(comercio);
        this.addSubcommand(bici);
        this.addSubcommand(cultura);
        this.addSubcommand(access);
    }

    async autocomplete(interaction) {
        const subcommandName = interaction.options.getSubcommand();
        const subcommand = this.subcommands.get(subcommandName);
        if (subcommand && subcommand.autocomplete) {
            await subcommand.autocomplete(interaction);
        }
    }
}

module.exports = new BuscarCommand();