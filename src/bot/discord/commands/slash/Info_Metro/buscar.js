// buscar.js
const { SlashCommandBuilder } = require('discord.js');
const MetroInfoProvider = require('../../../../../utils/MetroInfoProvider');
const comercio = require('./_buscarcomercio');
const bici = require('./_buscarcicletero');
const cultura = require('./_buscarcultura');
const access = require('./_buscaraccesibilidad');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('buscar')
        .setDescription('Buscar información en el sistema Metro')
        .addSubcommand(subcommand => comercio.data(subcommand))
    .addSubcommand(subcommand => bici.data(subcommand))
    .addSubcommand(subcommand => cultura.data(subcommand))
        .addSubcommand(subcommand => access.data(subcommand)),  

     
    
    category: "Metro Info",

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const metroInfoProvider = MetroInfoProvider.getInstance();
        
        switch(subcommand) {
            case 'comercio':
                return comercio.execute(interaction, metroInfoProvider);
                case 'cicletero':

                return bici.execute(interaction, metroInfoProvider);
                case 'cultura':

                return cultura.execute(interaction, metroInfoProvider);
                case 'accesibilidad':

                return access.execute(interaction, metroInfoProvider);
            default:
                return interaction.reply({ 
                    content: '⚠️ Subcomando no reconocido', 
                    ephemeral: true 
                });
        }
    }
};