const { SlashCommandBuilder } = require('discord.js');
const serverButtonsHandler = require('../src/events/interactions/buttons/serverButtons');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Muestra información detallada del servidor'),
    category: "Información",
    active: true,

    async execute(interaction) {
        try {
            await interaction.deferReply();
            const messagePayload = serverButtonsHandler.build(interaction);
            await interaction.editReply(messagePayload);
        } catch (error) {
            console.error('Error executing serverinfo command:', error);
            await interaction.editReply({
                content: '❌ Ocurrió un error al obtener la información del servidor.',
                ephemeral: true
            });
        }
    }
};