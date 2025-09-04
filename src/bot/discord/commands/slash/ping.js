const { SlashCommandBuilder } = require('@discordjs/builders');
const BaseCommand = require('../BaseCommand');
const { createEmbed } = require('../../../../utils/embeds');

class PingCommand extends BaseCommand {
    constructor() {
        super(new SlashCommandBuilder()
            .setName('ping')
            .setDescription('🏓 Mide la latencia del bot.')
        );
        this.active = true;
        this.category = "Bot Info";
    }

    async execute(interaction) {
        const startTime = Date.now();
        const wsLatency = Math.max(0, interaction.client.ws.ping);

        await interaction.deferReply({ ephemeral: true });

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        const embed = createEmbed(
            `🏓 **Pong!**\n` +
            `- Latencia del WebSocket: \`${wsLatency}ms\`\n` +
            `- Tiempo de respuesta: \`${responseTime}ms\``,
            'info'
        )
            .setThumbnail('https://i.imgur.com/xyz.png')
            .setFooter({ text: `Solicitado por ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
}

module.exports = new PingCommand();