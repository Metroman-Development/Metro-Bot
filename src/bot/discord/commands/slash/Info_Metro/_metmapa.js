const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const metroConfig = require('../../config/metro/metroConfig');
const styles = require('../../config/metro/styles');

module.exports = {
    parentCommand: 'metro',
    data: (subcommand) => subcommand
        .setName('mapa')
        .setDescription('Muestra información del Metro de Santiago'),

    async execute(interaction, metro) {
        // Create the embed
        const embed = new EmbedBuilder()
            .setTitle(`${metroConfig.logoMetroEmoji} Mapa de la Red Metro`)
            .setDescription('🗺️ Aquí tienes el mapa actual de la red Metro de Santiago.')
            .setImage('https://www.metro.cl/images/metrored_servicios_2023_07_19.jpg')
            .setColor(styles.defaultTheme.primaryColor)
            .setFooter({ text: 'Fuente: Metro de Santiago', iconURL: 'https://metro.cl/logo.png' });

        // Create a button with a link
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Ver en la web oficial')
                    .setURL('https://www.metro.cl/planifica-tu-viaje/mapa-de-la-red')
                    .setStyle(ButtonStyle.Link)
            );

        // Reply with the embed and button
        await interaction.reply({
            embeds: [embed],
            components: [row]
        });
    }
};