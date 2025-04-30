const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const os = require('os');

module.exports = {
    parentCommand: 'bot',
    data: (subcommand) => subcommand
        .setName('info')
        .setDescription('Muestra información técnica sobre el bot'),

    async execute(interaction) {
        const { client, guild } = interaction;
        
        // Calculate uptime
        const uptime = this.formatUptime(process.uptime());
        
        // Get memory usage
        const memoryUsage = process.memoryUsage().rss / 1024 / 1024;
        const totalMemory = os.totalmem() / 1024 / 1024 / 1024;
        
        // Create embed
        const embed = new EmbedBuilder()
            .setTitle('🤖 Información Técnica del Bot')
            .setColor(0x3498db)
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                { name: '⏱️ Uptime', value: uptime, inline: true },
                { name: '📊 Uso de memoria', value: `${memoryUsage.toFixed(2)} MB`, inline: true },
                { name: '🖥️ Servidor', value: `${os.type()} ${os.release()}`, inline: true },
                { name: '💾 RAM total', value: `${totalMemory.toFixed(2)} GB`, inline: true },
                { name: '📡 Ping', value: `${client.ws.ping}ms`, inline: true },
                { name: '📅 Creado el', value: client.user.createdAt.toLocaleDateString(), inline: true }
            )
            .setFooter({ text: `Solicitado por ${interaction.user.username}` });

        // Create components array
        const components = [];
        
        // Only add button if NOT in the specified guild
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

        await interaction.reply({ 
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