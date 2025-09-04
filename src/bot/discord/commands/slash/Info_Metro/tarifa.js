const { SlashCommandBuilder } = require('discord.js');
const BaseCommand = require('../../BaseCommand');
const tarifaActual = require('./_mtactual');
const tarifaHorarios = require('./_mthorarios');
const tarifaDiferenciada = require('./_mtdiferenciada');
const tarifaVer = require('./_mtver');

class TarifaCommand extends BaseCommand {
    constructor() {
        super(new SlashCommandBuilder()
            .setName('tarifa')
            .setDescription('Información sobre tarifas del Metro')
        );
        this.category = "Metro Info";

        this.addSubcommand(tarifaActual);
        this.addSubcommand(tarifaHorarios);
        this.addSubcommand(tarifaDiferenciada);
        this.addSubcommand(tarifaVer);
    }
}

module.exports = new TarifaCommand();