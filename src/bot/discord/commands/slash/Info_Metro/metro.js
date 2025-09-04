const { SlashCommandBuilder } = require('discord.js');
const BaseCommand = require('../../BaseCommand');
const info = require('./_metinfo');
const estado = require('./_metestado');
const mapa = require('./_metmapa');
const tren = require('./_mettren');
const planificar = require('./_metplanificar');

class MetroCommand extends BaseCommand {
    constructor() {
        super(new SlashCommandBuilder()
            .setName('metro')
            .setDescription('Información del Metro de Santiago')
        );
        this.category = "Metro Info";

        this.addSubcommand(info);
        this.addSubcommand(mapa);
        this.addSubcommand(estado);
        this.addSubcommand(tren);
        this.addSubcommand(planificar);
    }

    async autocomplete(interaction) {
        const subcommandName = interaction.options.getSubcommand();
        const subcommand = this.subcommands.get(subcommandName);
        if (subcommand && subcommand.autocomplete) {
            await subcommand.autocomplete(interaction);
        }
    }
}

module.exports = new MetroCommand();