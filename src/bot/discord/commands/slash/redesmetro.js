const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const BaseCommand = require('../BaseCommand');

class RedesMetroCommand extends BaseCommand {
    constructor() {
        super(new SlashCommandBuilder()
            .setName('redesmetro')
            .setDescription('Muestra las redes sociales del Metro de Santiago')
        );
        this.active = true;
        this.category = "Metro Info";
    }

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0xE30613) // Metro's red color
            .setTitle('🌐 Redes Sociales del Metro de Santiago')
            .setThumbnail('https://www.metro.cl/img/logo-metro.png')
            .addFields(
                { name: '💻 Sitio Web Oficial', value: '[metro.cl](https://www.metro.cl)' },
                { name: '🐦 Twitter/X', value: '👉 [@metrodesantiago](https://twitter.com/metrodesantiago)' },
                { name: '📷 Instagram', value: '👉 [@metrodesantiago](https://www.instagram.com/metrodesantiago/)' },
                { name: '📖Facebook', value: '👉 [Metro de Santiago](https://www.facebook.com/share/157dKE5Jt2/)' },
            )
            .setFooter({ text: 'Información actualizada en Marzo 2025' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
}

module.exports = new RedesMetroCommand();