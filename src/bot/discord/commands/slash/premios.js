const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const BaseCommand = require('../BaseCommand');
const bipConfig = require('../../../../config/bipConfig');

class PremiosCommand extends BaseCommand {
    constructor() {
        super(new SlashCommandBuilder()
            .setName('premios')
            .setDescription('Muestra las recompensas disponibles por nivel')
        );
        this.category = "Bip!Coin";
    }

    async run(interaction) {
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

        await interaction.reply({ embeds: [embed] });
    }
}

module.exports = new PremiosCommand();