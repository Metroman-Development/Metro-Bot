// File: metro.js

const { SlashCommandBuilder } = require('discord.js');

const { MetroInfoProvider } = require('../../../../../utils/MetroInfoProvider');

const info = require('./_metinfo');
const estado = require('./_metestado');
const mapa = require('./_metmapa');
const tren = require('./_mettren');
const planificar = require('./_metplanificar');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('metro')
        .setDescription('Información del Metro de Santiago')
        .addSubcommand(subcommand => info.data(subcommand))
        .addSubcommand(subcommand => mapa.data(subcommand))
        .addSubcommand(subcommand => estado.data(subcommand))
        .addSubcommand(subcommand => tren.data(subcommand))
        .addSubcommand(subcommand => planificar.data(subcommand)),
    category: "Metro Info",

    async getMetroInfoProvider() {
        try {
            const metroInfoProvider = MetroInfoProvider.getInstance();
            if (!metroInfoProvider) {
                throw new Error('MetroInfoProvider not initialized.');
            }
            return metroInfoProvider;
        } catch (error) {
            console.error('Failed to get MetroInfoProvider instance:', error);
            throw new Error('El sistema Metro no está disponible');
        }
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            const metroInfoProvider = await this.getMetroInfoProvider();

            switch(subcommand) {
                case 'info':
                    return info.execute(interaction, metroInfoProvider);
                case 'mapa':
                    return mapa.execute(interaction, metroInfoProvider);
                case 'estado':
                    return estado.execute(interaction, metroInfoProvider);
                case 'tren':
                    return tren.execute(interaction, metroInfoProvider);
                case 'planificar':
                    return planificar.execute(interaction, metroInfoProvider);
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