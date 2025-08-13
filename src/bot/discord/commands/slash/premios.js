const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const bipConfig = require('../../../../config/bipConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('premios')
        .setDescription('Muestra las recompensas disponibles por nivel'),
    category: "Bip!Coin", 
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🎁 **Recompensas por Nivel**')
            .setDescription('Aquí puedes ver las recompensas que puedes obtener al alcanzar ciertos niveles:')
            .setColor(0x0099FF)
            .addFields(
                bipConfig.LEVEL_REWARDS.map(reward => ({
                    name: `📊 **Nivel ${reward.level}**`,
                    value: `- 🏆 **Rol**: \`${reward.role}\``,
                    inline: true
                }))
            );

        await interaction.followUp({ embeds: [embed] });
    }
};