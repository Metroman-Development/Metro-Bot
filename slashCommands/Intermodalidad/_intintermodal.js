// _intintermodal.js
// _intintermodal.js
// _intintermodal.js
const { SlashCommandBuilder } = require('discord.js');
const IntermodalButton = require('../../modules/interactions/buttons/IntermodalButton');

module.exports = {
    parentCommand: 'intermodalidad',
    data: (subcommand) => subcommand
        .setName('intermodal')
        .setDescription('Información sobre estaciones intermodales')
        .addStringOption(option =>
            option.setName('estacion')
                .setDescription('Nombre de la estación intermodal')
                .setRequired(true)
                .addChoices(
                    { name: 'Bellavista de la Florida', value: 'Bellavista de la Florida' },
                    { name: 'Del Sol', value: 'Del Sol' },
                    { name: 'Franklin', value: 'Franklin' },
                    { name: 'La Cisterna', value: 'La Cisterna' },
                    { name: 'Lo Ovalle', value: 'Lo Ovalle' },
                    { name: 'Los Libertadores', value: 'Los Libertadores' },
                    { name: 'Pajaritos', value: 'Pajaritos' },
                    { name: 'Vespucio Norte', value: 'Vespucio Norte' }
                )
        ),

    async execute(interaction, metro) {
        try {
            await interaction.deferReply();
            
            const stationName = interaction.options.getString('estacion');
            const normalizedId = stationName.toLowerCase().replace(/\s+/g, '_');
            const stationInfo = metro._staticData.intermodal?.[normalizedId];

            if (!stationInfo) {
                return interaction.editReply({
                    content: 'ℹ️ No se encontró información para esta estación.',
                    ephemeral: true
                });
            }

            const buttonHandler = new IntermodalButton();
            const response = await buttonHandler.buildInitialView(stationInfo, stationName);
            await interaction.editReply(response);
        } catch (error) {
            console.error('Error en /intermodal:', error);
            await interaction.editReply({
                content: '❌ Error al cargar la información.',
                ephemeral: true
            });
        }
    }
};