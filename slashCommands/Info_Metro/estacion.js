const { SlashCommandBuilder } = require('discord.js');
const MetroCore = require('../../modules/metro/core/MetroCore');
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
    
    /**
     * Retrieves or initializes the MetroCore instance.
     * @param {import('discord.js').Interaction} interaction The interaction object.
     * @returns {Promise<MetroCore>} The MetroCore instance.
     * @throws {Error} If the MetroCore instance cannot be initialized.
     */
    async getMetroCore(interaction) {
        try {
            // Check if the instance already exists and is initialized.
            if (!interaction.client.metroCore || !interaction.client.metroCore.api) {
                interaction.client.metroCore = await MetroCore.getInstance({ 
                    client: interaction.client 
                });
            }
            return interaction.client.metroCore;
        } catch (error) {
            console.error('Failed to initialize or retrieve MetroCore instance:', error);
            throw new Error('No se pudo conectar con el sistema de Metro. Por favor, inténtalo de nuevo más tarde.');
        }
    },

    /**
     * Executes the 'estacion' command.
     * @param {import('discord.js').Interaction} interaction The interaction object.
     */
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        try {
            // Ensure MetroCore is available before executing any subcommand.
            const metro = await this.getMetroCore(interaction);
            
            // Route to the appropriate subcommand handler.
            switch(subcommand) {
                case 'estado':
                    return estado.execute(interaction, metro); 
                case 'info':
                    return info.execute(interaction, metro);
                default:
                    return interaction.reply({ 
                        content: '⚠️ Subcomando no reconocido. Por favor, elige una de las opciones disponibles.',
                        ephemeral: true 
                    });
            }
        } catch (error) {
            console.error(`An error occurred in the /estacion ${subcommand} command:`, error);
            return interaction.reply({
                content: `❌ ${error.message || 'Ocurrió un error al procesar tu solicitud.'}`,
                ephemeral: true
            });
        }
    }
};