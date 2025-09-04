const { SlashCommandBuilder } = require('discord.js');
const BaseCommand = require('../../BaseCommand');
const intermodal = require('./_intintermodal');

class IntermodalidadCommand extends BaseCommand {
    constructor() {
        super(new SlashCommandBuilder()
            .setName('intermodalidad')
            .setDescription('Información sobre estaciones intermodales (combinación Metro + buses)')
        );
        this.category = "Transporte Público";

        this.addSubcommand(intermodal);
    }
}

module.exports = new IntermodalidadCommand();