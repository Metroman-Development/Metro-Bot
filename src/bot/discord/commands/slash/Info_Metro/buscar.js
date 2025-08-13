// buscar.js
const { SlashCommandBuilder } = require('discord.js');
const MetroCore = require('../../../../../core/metro/core/MetroCore');
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
    
    async getMetroCore(interaction) {
        try {
            if (!interaction.client.metroCore || !interaction.client.metroCore.api) {
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
        const metro = await this.getMetroCore(interaction);
        
        switch(subcommand) {
            case 'comercio':
                return comercio.execute(interaction, metro);
                case 'cicletero':

                return bici.execute(interaction, metro);
                case 'cultura':

                return cultura.execute(interaction, metro);
                case 'accesibilidad':

                return access.execute(interaction, metro);
            default:
                return interaction.reply({ 
                    content: '⚠️ Subcomando no reconocido', 
                    ephemeral: true 
                });
        }
    }
};