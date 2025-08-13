const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../../../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Muestra el top 10 de usuarios con más Bip!Coins'),
    category: "Bip!Coin",
    async execute(interaction) {
        try {
            const [ranking] = await pool.query(`
                SELECT 
                    username,
                    bip_coins 
                FROM users 
                ORDER BY bip_coins DESC 
                LIMIT 10
            `);

            const embed = new EmbedBuilder()
                .setTitle('🏆 Leaderboard')
                .setDescription('Top 10 usuarios con más Bip!Coins')
                .addFields(
                    { 
                        name: 'Top 10', 
                        value: ranking.map((u, i) => `${i + 1}. ${u.username} - ${u.bip_coins}`).join('\n') || 'Vacío'
                    }
                )
                .setColor(0x0099FF);

            await interaction.followUp({ embeds: [embed] });
        } catch (error) {
            console.error('❌ Error en /leaderboard:', error);
            await interaction.followUp('❌ Error al obtener el leaderboard.');
        }
    }
};