const { SlashCommandBuilder } = require('discord.js');
const { MetroInfoProvider } = require('../../../../../utils/MetroInfoProvider');
const info = require('./_expinfo'); 
const ayuda = require('./_expayuda'); 
// Subcommand file

module.exports = {
    data: new SlashCommandBuilder()
        .setName('expreso')
        .setDescription('Información sobre rutas expresas del Metro de Santiago')
        .addSubcommand(subcommand => info.data(subcommand)) // Add info subcommand
    .addSubcommand(subcommand => ayuda.data(subcommand)), 

    category: "Metro Info",

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        try {
            const metroInfoProvider = MetroInfoProvider.getInstance();
            
            switch(subcommand) {
                case 'info':
                    return info.execute(interaction, metroInfoProvider);
                    case 'ayuda':

                    return ayuda.execute(interaction);
                default:
                    return interaction.reply({ 
                        content: '⚠️ Subcomando no reconocido', 
                        ephemeral: true 
                    });
            }
        } catch (error) {
            console.error(`Error in /expreso ${subcommand}:`, error);
            return interaction.reply({
                content: '❌ Error al obtener información de rutas expresas',
                ephemeral: true
            });
        }
    }
};