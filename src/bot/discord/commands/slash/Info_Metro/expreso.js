const { SlashCommandBuilder } = require('discord.js');
const BaseCommand = require('../../BaseCommand');
const info = require('./_expinfo');
const ayuda = require('./_expayuda');

class ExpresoCommand extends BaseCommand {
    constructor() {
        super(new SlashCommandBuilder()
            .setName('expreso')
            .setDescription('Información sobre rutas expresas del Metro de Santiago')
        );
        this.category = "Metro Info";

        this.addSubcommand(info);
        this.addSubcommand(ayuda);
    }
}

module.exports = new ExpresoCommand();