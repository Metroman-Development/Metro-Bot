const { SlashCommandBuilder } = require('discord.js');
const { getMetroCore } = require('../../../../../utils/metroUtils');
const { handleCommandError } = require('../../../../../utils/commandUtils');
const estado = require('./_linestado');
const info = require('./_lininfo');
const proyecto = require('./_linproyecto');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('linea')
        .setDescription('Información de una línea')
        .addSubcommand(subcommand => estado.data(subcommand))
        .addSubcommand(subcommand => info.data(subcommand))
        .addSubcommand(subcommand => proyecto.data(subcommand)),

    category: "Metro Info",

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        try {
            const metro = await getMetroCore(interaction);
            
            switch(subcommand) {
                case 'estado':
                    return estado.execute(interaction, metro); 
                case 'info':
                    return info.execute(interaction, metro);
                case 'proyecto':
                    return proyecto.execute(interaction, metro);
                default:
                    return interaction.reply({ 
                        content: '⚠️ Subcomando no reconocido', 
                        ephemeral: true 
                    });
            }
        } catch (error) {
            await handleCommandError(error, interaction);
        }
    }
};