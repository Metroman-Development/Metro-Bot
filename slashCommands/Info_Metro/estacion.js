const { SlashCommandBuilder } = require('discord.js');
const MetroCore = require('../../modules/metro/core/MetroCore'); // Import MetroCore
const estado = require('./_estestado');

const info = require('./_estinfo');
// Import other subcommands as needed
// const horarios = require('./horarios');
// const incidentes = require('./incidentes');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('estacion')
        .setDescription('Información de una estación')
        .addSubcommand(subcommand => estado.data(subcommand))
      .addSubcommand(subcommand => info.data(subcommand)),

    
    
    
    
        // Add other subcommands as needed:
        // .addSubcommand(subcommand => horarios.data(subcommand))
        // .addSubcommand(subcommand => incidentes.data(subcommand))

    category: "Metro Info",
    
    /**
     * Gets the MetroCore instance and makes it available tosubcommands
     */
    async getMetroCore(interaction) {
        try {
            if (!interaction.client.metroCore ||!interaction.client.metroCore.api) {
                interaction.client.metroCore = await MetroCore.getInstance({ 
                    client: interaction.client 
                });
            }
            return interaction.client.metroCore;
        } catch (error) {
            console.error('Failed to get MetroCore instance:', error);
            throw new Error('El sistema Metro no está disponible');
        }
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        try {
            // Make MetroCore available to all subcommands
            const metro = await this.getMetroCore(interaction);
            
            // Route to the appropriate subcommand
            switch(subcommand) {
                case 'estado':
                    return estado.execute(interaction, metro); 
               case 'info':
                    return info.execute(interaction, metro);
                    
                    // Pass metro instance
                // case 'horarios':
                //     return horarios.execute(interaction, metro);
                // case 'incidentes':
                //     return incidentes.execute(interaction, metro);
                default:
                    return interaction.reply({ 
                        content: '⚠️ Subcomando no reconocido', 
                        ephemeral: true 
                    });
            }
        } catch (error) {
            console.error(`Error in /metro ${subcommand}:`, error);
            return interaction.reply({
                content: '❌ Error al conectar con el sistema Metro',
                ephemeral: true
            });
        }
    }
};