



const { SlashCommandBuilder } = require('discord.js');

// Import subcommands

const calendarioSemana = require('./_mesemana');

const calendarioMes = require('./_memes');

const calendarioEventos = require('./_meeventos');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('calendario-metro')

        .setDescription('Información de calendario del Metro')

        .addSubcommand(subcommand => calendarioSemana.data(subcommand))

        .addSubcommand(subcommand => calendarioMes.data(subcommand))

        .addSubcommand(subcommand => calendarioEventos.data(subcommand)),

    category: "Metro Calendar",

    async execute(interaction) {

        const subcommand = interaction.options.getSubcommand();

        

        try {

            switch(subcommand) {

                case 'semana':

                    return calendarioSemana.execute(interaction);

                case 'mes':

                    return calendarioMes.execute(interaction);

                case 'eventos':

                    return calendarioEventos.execute(interaction);

                default:

                    return interaction.reply({

                        content: '⚠️ Subcomando no reconocido',

                        ephemeral: true

                    });

            }

        } catch (error) {

            console.error(`Error en calendario-metro ${subcommand}:`, error);

            return interaction.reply({

                content: '❌ Error al obtener datos del calendario',

                ephemeral: true

            });

        }

    }

};



