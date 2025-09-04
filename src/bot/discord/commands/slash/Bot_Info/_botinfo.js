const { SlashCommandSubcommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const os = require('os');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('info')
        .setDescription('Muestra información técnica sobre el bot.'),

    async execute(interaction) {
        await interaction.deferReply();
        const { client, guild } = interaction;

        const uptime = this.formatUptime(process.uptime());

        const memoryUsage = process.memoryUsage().rss / 1024 / 1024;
        const totalMemory = os.totalmem() / 1024 / 1024 / 1024;

        const embed = new EmbedBuilder()
            .setTitle('🤖 Información Técnica del Bot')
            .setColor(0x3498db)
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                { name: '⏱️ Uptime', value: uptime, inline: true },
                { name: '📊 Uso de Memoria', value: `${memoryUsage.toFixed(2)} MB`, inline: true },
                { name: '🖥️ Servidor', value: `${os.type()} ${os.release()}`, inline: true },
                { name: '💾 RAM Total', value: `${totalMemory.toFixed(2)} GB`, inline: true },
                { name: '📡 Ping', value: `${client.ws.ping}ms`, inline: true },
                { name: '📅 Creado el', value: client.user.createdAt.toLocaleDateString(), inline: true }
            )
            .setFooter({ text: `Solicitado por ${interaction.user.username}` });

        const components = [];

        if (!guild || guild.id !== '899841261740113980') {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Únete al Discord de Metro de Santiago')
                        .setURL('https://discord.gg/2zfHGbvc8p')
                        .setStyle(ButtonStyle.Link)
                );
            components.push(row);
        }

        await interaction.editReply({
            embeds: [embed],
            components: components
        });
    },

    formatUptime(seconds) {
        const days = Math.floor(seconds / (3600 * 24));
        seconds %= 3600 * 24;
        const hours = Math.floor(seconds / 3600);
        seconds %= 3600;
        const minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds % 60);

        return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }
};