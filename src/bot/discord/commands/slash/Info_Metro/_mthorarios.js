const { SlashCommandSubcommandBuilder, EmbedBuilder } = require('discord.js');
const TimeHelpers = require('../../../../../utils/timeHelpers');
const metroConfig = require('../../../../../config/metro/metroConfig');
const styles = require('../../../../../config/styles.json');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('horarios')
        .setDescription('Muestra los horarios de operación del Metro'),

    async execute(interaction) {
        await interaction.deferReply();

        const operatingHours = TimeHelpers.getOperatingHours();

        const embed = new EmbedBuilder()
            .setTitle(`${metroConfig.logoMetroEmoji} Horarios de Operación`)
            .setColor(styles.defaultTheme.primaryColor)
            .addFields(
                { name: 'Lunes a Viernes', value: `${operatingHours.weekday.opening} - ${operatingHours.weekday.closing}`, inline: true },
                { name: 'Sábado', value: `${operatingHours.saturday.opening} - ${operatingHours.saturday.closing}`, inline: true },
                { name: 'Domingo y Festivos', value: `${operatingHours.sunday.opening} - ${operatingHours.sunday.closing}`, inline: true },
            )
            .setFooter({
                text: 'Los horarios pueden variar por eventos especiales.',
                iconURL: metroConfig.metroLogo.v4
            });

        await interaction.editReply({ embeds: [embed] });
    }
};