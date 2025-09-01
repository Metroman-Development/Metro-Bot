// intermodalidad.js
const { SlashCommandBuilder } = require('discord.js');
const intermodal = require('./_intintermodal');
const MetroInfoProvider = require('../../../../utils/MetroInfoProvider');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('intermodalidad')
        .setDescription('Información sobre estaciones intermodales (combinación Metro + buses)')
        .addSubcommand(subcommand => intermodal.data(subcommand)),
    
    category: "Transporte Público",

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        try {
            // Get MetroInfoProvider instance
            const metroInfoProvider = this.getMetroInfoProvider(interaction);
            
            switch(subcommand) {
                case 'intermodal':
                    return intermodal.execute(interaction, metroInfoProvider);
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

    getMetroInfoProvider(interaction) {
        try {
            return MetroInfoProvider.getInstance();
        } catch (error) {
            console.error('Failed to get MetroInfoProvider instance:', error);
            throw new Error('El sistema de transporte no está disponible');
        }
    }
};