const { SlashCommandBuilder } = require('discord.js');
const { handleCommandError } = require('../../../../../utils/commandUtils');
const MetroInfoProvider = require('../../../../../utils/MetroInfoProvider');
const estado = require('./_estestado');
const info = require('./_estinfo');

/**
 * @file Command for retrieving information about a specific metro station.
 * @description This command provides access to various subcommands related to a metro station, such as its status and general information.
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('estacion')
        .setDescription('Proporciona información sobre una estación de metro específica.')
        .addSubcommand(subcommand => estado.data(subcommand))
        .addSubcommand(subcommand => info.data(subcommand)),

    category: "Metro Info",

    async autocomplete(interaction, metroInfoProvider) {
        const subcommand = interaction.options.getSubcommand();
        switch(subcommand) {
            case 'info':
                return info.autocomplete(interaction, metroInfoProvider);
            case 'estado':
                return estado.autocomplete(interaction, metroInfoProvider);
            default:
                break;
        }
    },
    
    /**
     * Executes the 'estacion' command.
     * @param {import('discord.js').Interaction} interaction The interaction object.
     */
    async execute(interaction, metroInfoProvider) {
        const subcommand = interaction.options.getSubcommand();
        
        try {
            await interaction.deferReply({ ephemeral: true });
            
            // Route to the appropriate subcommand handler.
            switch(subcommand) {
                case 'estado':
                    return estado.execute(interaction, metroInfoProvider);
                case 'info':
                    return info.execute(interaction, metroInfoProvider);
                default:
                    return interaction.editReply({
                        content: '⚠️ Subcomando no reconocido. Por favor, elige una de las opciones disponibles.',
                        ephemeral: true 
                    });
            }
        } catch (error) {
            await handleCommandError(error, interaction);
        }
    }
};