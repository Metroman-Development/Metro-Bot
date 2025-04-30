// File: metro.js

const { SlashCommandBuilder } = require('discord.js');

const MetroCore = require('../../modules/metro/core/MetroCore');

const info = require('./_metinfo');

const estado = require('./_metestado');

const mapa = require('./_metmapa');

const tren = require('./_mettren');

const planificar = require('./_metplanificar'); // Add the new subcommand

module.exports = {

    data: new SlashCommandBuilder()

        .setName('metro')

        .setDescription('Información del Metro de Santiago')

        .addSubcommand(subcommand => info.data(subcommand))

        .addSubcommand(subcommand => mapa.data(subcommand))

        .addSubcommand(subcommand => estado.data(subcommand))

        .addSubcommand(subcommand => tren.data(subcommand))

        .addSubcommand(subcommand => planificar.data(subcommand)), // Add planificar subcommand

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

        

        try {

            const metro = await this.getMetroCore(interaction);

            

            switch(subcommand) {

                case 'info':

                    return info.execute(interaction, metro);

                case 'mapa':

                    return mapa.execute(interaction, metro);

                case 'estado':

                    return estado.execute(interaction, metro);

                case 'tren':

                    return tren.execute(interaction, metro);

                case 'planificar':

                    return planificar.execute(interaction, metro); // Handle planificar

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