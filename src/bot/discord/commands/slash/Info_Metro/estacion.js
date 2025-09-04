const { SlashCommandBuilder } = require('discord.js');
const BaseCommand = require('../../BaseCommand');
const estado = require('./_estestado');
const info = require('./_estinfo');

class EstacionCommand extends BaseCommand {
    constructor() {
        super(new SlashCommandBuilder()
            .setName('estacion')
            .setDescription('Proporciona información sobre una estación de metro específica.')
        );
        this.category = "Metro Info";

        this.addSubcommand(estado);
        this.addSubcommand(info);
    }

    async autocomplete(interaction) {
        const subcommandName = interaction.options.getSubcommand();
        const subcommand = this.subcommands.get(subcommandName);
        if (subcommand && subcommand.autocomplete) {
            await subcommand.autocomplete(interaction);
        }
    }
}

module.exports = new EstacionCommand();