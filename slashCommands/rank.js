const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../utils/database');
const bipcoinUtils = require('../utils/bipcoinUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Muestra tu rango, nivel, Bip!Coins y racha')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('El usuario cuyo rango deseas ver')
                .setRequired(false)),
    
    category: "Bip!Coin", 
    async execute(interaction) {
        const targetUser = interaction.options.getUser('usuario') || interaction.user;
        const userId = targetUser.id;

        try {
            const [user] = await pool.query('SELECT bip_coins, role, activity_streak FROM users WHERE id = ?', [userId]);
            const [ranking] = await pool.query('SELECT username, bip_coins FROM users ORDER BY bip_coins DESC LIMIT 10');

            if (!user[0]) {
                return interaction.followUp('❌ Este usuario no tiene Bip!Coins aún.');
            }

            const level = bipcoinUtils.calculateLevel(user[0].bip_coins);
            const nextLevelCoins = bipcoinUtils.calculateBipCoinsForLevel(level + 1);

            const embed = new EmbedBuilder()
                .setTitle(`🏅 **Rango de ${targetUser.username}**`)
                .setColor(0x0099FF)
                .addFields(
                    { name: '🌟 **Nivel**', value: `\`${level}\``, inline: true },
                    { name: '💰 **Bip!Coins**', value: `\`${user[0].bip_coins}\``, inline: true },
                    { name: '🔥 **Racha**', value: `\`${user[0].activity_streak} días\``, inline: true },
                    { name: '📈 **Próximo Nivel**', value: `\`${nextLevelCoins - user[0].bip_coins} Bip!Coins restantes\``, inline: true },
                    { 
                        name: '🏆 **Top 10**', 
                        value: ranking.map((u, i) => `**${i + 1}.** \`${u.username}\` - \`${u.bip_coins} Bip!Coins\``).join('\n') || 'Vacío'
                    }
                );

            await interaction.followUp({ embeds: [embed] });
        } catch (error) {
            console.error('❌ Error en /rank:', error);
            await interaction.followUp('❌ Error al obtener el rango.');
        }
    }
};