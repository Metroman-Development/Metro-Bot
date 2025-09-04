const { SlashCommandSubcommandBuilder, EmbedBuilder } = require('discord.js');
const { version: botVersion } = require('../../../../../../package.json');
const { MetroInfoProvider } = require('../../../../../utils/MetroInfoProvider');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('version')
        .setDescription('Muestra la versión del sistema de datos del Metro'),

    async run(interaction) {
        await interaction.deferReply();
        const metroInfoProvider = MetroInfoProvider.getInstance();
        const metroData = metroInfoProvider.getFullData();
        const dataVersion = metroData.version || 'No disponible';
        const lastUpdated = metroData.last_updated ? new Date(metroData.last_updated).toLocaleString('es-CL', { timeZone: 'America/Santiago' }) : 'No disponible';

        const embed = new EmbedBuilder()
            .setTitle('📊 Versión de Datos del Metro')
            .setColor('#2C3E50')
            .addFields(
                { name: 'Versión del Bot', value: botVersion, inline: true },
                { name: 'Versión de Datos Metro', value: dataVersion, inline: true },
                { name: 'Última Actualización de Datos', value: lastUpdated, inline: false }
            )
            .setFooter({ text: 'MetroBot by MetroMan' });

        await interaction.editReply({ embeds: [embed] });
    }
};
