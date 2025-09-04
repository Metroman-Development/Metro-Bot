const { SlashCommandSubcommandBuilder } = require('discord.js');
const expressButtonsHandler = require('../../../../../events/interactions/buttons/expressButtons');
const { MetroInfoProvider } = require('../../../../../utils/MetroInfoProvider');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('info')
        .setDescription('Muestra información sobre las rutas expresas')
        .addStringOption(option =>
            option.setName('linea')
                .setDescription('Selecciona una línea para ver sus rutas expresas')
                .setRequired(true)
                .addChoices(
                    { name: '🚇 Línea 2', value: 'l2' },
                    { name: '🚇 Línea 4', value: 'l4' },
                    { name: '🚇 Línea 5', value: 'l5' }
                )
        ),

    async execute(interaction) {
        await interaction.deferReply();
        const metroInfoProvider = MetroInfoProvider.getInstance();
        const messagePayload = await expressButtonsHandler.build(interaction, metroInfoProvider);
        await interaction.editReply(messagePayload);
    }
};