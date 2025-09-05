const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const BaseCommand = require('../BaseCommand');
const DatabaseManager = require('../../../../core/database/DatabaseManager');

class LeaderboardCommand extends BaseCommand {
    constructor() {
        super(new SlashCommandBuilder()
            .setName('leaderboard')
            .setDescription('Muestra el top 10 de usuarios con más Bip!Coins')
        );
        this.category = "Bip!Coin";
    }

    async execute(interaction) {
        await interaction.deferReply();
        const dbManager = await DatabaseManager.getInstance();
        const ranking = await dbManager.query(`
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

        await interaction.editReply({ embeds: [embed] });
    }
}

module.exports = new LeaderboardCommand();