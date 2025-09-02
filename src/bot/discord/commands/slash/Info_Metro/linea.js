const { SlashCommandBuilder } = require('discord.js');
const { MetroInfoProvider } = require('../../../../../utils/MetroInfoProvider');
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
            const metroInfoProvider = MetroInfoProvider.getInstance();
            
            switch(subcommand) {
                case 'estado':
                    return estado.execute(interaction, metroInfoProvider);
                case 'info':
                    return info.execute(interaction, metroInfoProvider);
                case 'proyecto':
                    return proyecto.execute(interaction, metroInfoProvider);
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