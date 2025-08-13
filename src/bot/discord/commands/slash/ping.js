const { SlashCommandBuilder } = require('@discordjs/builders');

const { createEmbed } = require('../utils/embeds');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('ping')

        .setDescription('🏓 Mide la latencia del bot.'), // Description in Spanish

    active: true, 
    
    category: "Bot Info", 
    
    async execute(interaction) {

        // Get the current timestamp

        const startTime = Date.now();

        // Calculate the bot's latency (WebSocket ping)

        const wsLatency = Math.max(0, interaction.client.ws.ping); // Ensure non-negative value

        // Reply to the interaction and measure response time

        await interaction.followUp({ content: 'Calculando latencia...', ephemeral: true });

        // Get the response time

        const endTime = Date.now();

        const responseTime = endTime - startTime;

        // Create an embed response

        const embed = createEmbed(

            `🏓 **Pong!**\n` +

            `- Latencia del WebSocket: \`${wsLatency}ms\`\n` +

            `- Tiempo de respuesta: \`${responseTime}ms\``,

            'info'

        )

            .setThumbnail('https://i.imgur.com/xyz.png') // Replace with your thumbnail URL

            .setFooter({ text: `Solicitado por ${interaction.user.tag}` })

            .setTimestamp(); // Add a timestamp

        // Edit the original reply with the embed

        await interaction.editReply({ content: '', embeds: [embed] });

    },

};