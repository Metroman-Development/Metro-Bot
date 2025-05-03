const { SlashCommandBuilder } = require('discord.js');
const info = require('./_botinfo');
const comandos = require('./_botcomandos');
const iconografia = require('./_boticonografia');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bot')
        .setDescription('Comandos de información del bot')
        .addSubcommand(subcommand => info.data(subcommand))
        .addSubcommand(subcommand => comandos.data(subcommand))
        .addSubcommand(subcommand => iconografia.data(subcommand)),

    category: "Bot Info",

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        try {
            switch(subcommand) {
                case 'info':
                    return info.execute(interaction);
                case 'comandos':
                    return comandos.execute(interaction);
                case 'iconografia':
                    return iconografia.execute(interaction);
                default:
                    return interaction.reply({ 
                        content: '⚠️ Subcomando no reconocido', 
                        ephemeral: true 
                    });
            }
        } catch (error) {
            console.error(`Error in /bot ${subcommand}:`, error);
            return interaction.reply({
                content: '❌ Error al ejecutar el comando',
                ephemeral: true
            });
        }
    }
};