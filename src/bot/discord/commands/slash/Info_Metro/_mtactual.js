const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const TimeHelpers = require('../../../../../utils/timeHelpers');
const metroConfig = require('../../../../../config/metro/metroConfig');
const styles = require('../../../../../config/styles.json');

module.exports = {
    parentCommand: 'servicio-metro',
    data: (subcommand) => subcommand
        .setName('actual')
        .setDescription('Muestra el estado actual del servicio de Metro'),

    async execute(interaction, metroInfoProvider) {
        try {
            await interaction.deferReply();

            const metroData = metroInfoProvider.getFullData();
            const networkStatus = metroData.network_status;
            const currentPeriod = TimeHelpers.getCurrentPeriod();
            const isExpressActive = TimeHelpers.isExpressActive();
            const operatingHours = TimeHelpers.getOperatingHours();

            const embed = new EmbedBuilder()
                .setTitle(`${metroConfig.logoMetroEmoji} Estado Actual del Servicio`)
                .setColor(styles.defaultTheme.primaryColor)
                .setDescription(
                    `**Estado General:** ${networkStatus.status || 'Desconocido'}\n` +
                    `📝 ${networkStatus.summary?.es?.resumen || 'Sin información adicional'}\n\n` +
                    `⏰ **Período Tarifario:** ${currentPeriod.name}\n` +
                    `🚄 **Servicio Expreso:** ${isExpressActive ? 'ACTIVO' : 'No activo'}\n` +
                    `🕒 **Horario:** ${operatingHours.opening} - ${operatingHours.closing}` +
                    (operatingHours.isExtended ? ` (Extendido)` : '')
                )
                .setFooter({
                    text: `Actualizado: ${new Date(networkStatus.timestamp).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}`,
                    iconURL: 'https://cdn.discordapp.com/emojis/1349494723760492594.webp'
                });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error en comando servicio-metro actual:', error);
            await interaction.editReply({
                content: '❌ Ocurrió un error al obtener el estado actual del servicio',
                ephemeral: true
            });
        }
    }
};