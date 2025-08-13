
const { SlashCommandBuilder } = require('discord.js');

// Import subcommands
//const servicioEstado = require('./_meestado');
const servicioHorario = require('./_mehorario');
const servicioPeriodo = require('./_meperiodo');
const servicioHora = require('./_mehora');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('servicio-metro')
        .setDescription('Estado del servicio en tiempo real')
        //.addSubcommand(subcommand => servicioEstado.data(subcommand))
        .addSubcommand(subcommand => servicioHorario.data(subcommand))
        .addSubcommand(subcommand => servicioPeriodo.data(subcommand))
        .addSubcommand(subcommand => servicioHora.data(subcommand)),

    category: "Metro Service",

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        try {
            switch(subcommand) {
                case 'estado':
                    return servicioEstado.execute(interaction);
                case 'horario':
                    return servicioHorario.execute(interaction);
                case 'periodo':
                    return servicioPeriodo.execute(interaction);
                case 'hora':
                    return servicioHora.execute(interaction);
                default:
                    return interaction.reply({
                        content: '⚠️ Subcomando no reconocido',
                        ephemeral: true
                    });
            }
        } catch (error) {
            console.error(`Error en servicio-metro ${subcommand}:`, error);
            return interaction.reply({
                content: '❌ Error al obtener estado del servicio',
                ephemeral: true
            });
        }
    }
};
  
