const { SlashCommandBuilder } = require('discord.js');
const { MetroInfoProvider } = require('../../../../../utils/MetroInfoProvider');
const { handleCommandError } = require('../../../../../utils/commandUtils');
const actual = require('./_mtactual');
const horarios = require('./_mthorarios');
const diferenciada = require('./_mtdiferenciada');
const version = require('./_mtver');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('servicio-metro')
        .setDescription('Información sobre el servicio de Metro')
        .addSubcommand(subcommand => actual.data(subcommand))
        .addSubcommand(subcommand => horarios.data(subcommand))
        .addSubcommand(subcommand => diferenciada.data(subcommand))
        .addSubcommand(subcommand => version.data(subcommand)),

    category: "Metro Info",

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        try {
            const metroInfoProvider = MetroInfoProvider.getInstance();

            switch(subcommand) {
                case 'actual':
                    return actual.execute(interaction, metroInfoProvider);
                case 'horarios':
                    return horarios.execute(interaction, metroInfoProvider);
                case 'diferenciada':
                    return diferenciada.execute(interaction, metroInfoProvider);
                case 'version':
                    return version.execute(interaction, metroInfoProvider);
                default:
                    return interaction.reply({
                        content: '⚠️ Subcomando no reconocido',
                        ephemeral: true
                    });
            }
        } catch (error) {
            await handleCommandError(error, interaction);
        }
    }
};
