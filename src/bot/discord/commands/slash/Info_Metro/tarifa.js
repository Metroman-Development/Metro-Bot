const { SlashCommandBuilder } = require('discord.js');

// Import subcommands
const tarifaActual = require('./_mtactual');
const tarifaHorarios = require('./_mthorarios');
const tarifaDiferenciada = require('./_mtdiferenciada');
const tarifaVer = require('./_mtver');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tarifa')
        .setDescription('Información sobre tarifas del Metro')
        .addSubcommand(subcommand => tarifaActual.data(subcommand))
        .addSubcommand(subcommand => tarifaHorarios.data(subcommand))
        .addSubcommand(subcommand => tarifaDiferenciada.data(subcommand))
        .addSubcommand(subcommand => tarifaVer.data(subcommand)),

    category: "Metro Info",

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        try {
            switch(subcommand) {
                case 'actual':
                    return tarifaActual.execute(interaction);
                case 'horarios':
                    return tarifaHorarios.execute(interaction);
                case 'diferenciada':
                    return tarifaDiferenciada.execute(interaction);
                case 'ver':
                    return tarifaVer.execute(interaction);
                default:
                    return interaction.reply({
                        content: '⚠️ Subcomando no reconocido',
                        ephemeral: true
                    });
            }
        } catch (error) {
            console.error(`Error en tarifa ${subcommand}:`, error);
            return interaction.reply({
                content: '❌ Error al obtener información de tarifas',
                ephemeral: true
            });
        }
    }
};