// intermodalidad.js
const { SlashCommandBuilder } = require('discord.js');
const intermodal = require('./_intintermodal');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('intermodalidad')
        .setDescription('Información sobre estaciones intermodales (combinación Metro + buses)')
        .addSubcommand(subcommand => intermodal.data(subcommand)),
    
    category: "Transporte Público",

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        try {
            // Get MetroCore instance if needed (similar to metro.js)
            const metro = await this.getMetroCore(interaction);
            
            switch(subcommand) {
                case 'intermodal':
                    return intermodal.execute(interaction, metro);
                default:
                    return interaction.reply({ 
                        content: '⚠️ Subcomando no reconocido', 
                        ephemeral: true 
                    });
            }
        } catch (error) {
            console.error(`Error in /intermodalidad ${subcommand}:`, error);
            return interaction.reply({
                content: '❌ Error al obtener datos de intermodalidad',
                ephemeral: true
            });
        }
    },

    async getMetroCore(interaction) {
        try {
            if (!interaction.client.metroCore || !interaction.client.metroCore.api) {
                const MetroCore = require('../../../../../core/metro/MetroCore.js');
                interaction.client.metroCore = await MetroCore.getInstance({ 
                    client: interaction.client 
                });
            }
            return interaction.client.metroCore;
        } catch (error) {
            console.error('Failed to get MetroCore instance:', error);
            throw new Error('El sistema de transporte no está disponible');
        }
    }
};