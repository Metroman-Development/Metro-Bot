const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const BaseCommand = require('../BaseCommand');
const bipcoinUtils = require('../../../../utils/bipcoinUtils');

class NivelesCommand extends BaseCommand {
    constructor() {
        super(new SlashCommandBuilder()
            .setName('niveles')
            .setDescription('Muestra cuántos Bip!Coins se necesitan para cada nivel')
        );
        this.category = "Bip!Coin";
    }

    async execute(interaction) {
        const levels = [];
        for (let level = 1; level <= 100; level++) {
            levels.push({
                level: level,
                bipCoins: bipcoinUtils.calculateBipCoinsForLevel(level)
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('📊 **Niveles y Bip!Coins Requeridos**')
            .setDescription('Aquí puedes ver cuántos **Bip!Coins** necesitas para alcanzar cada nivel:')
            .setColor(0x0099FF);

        for (let i = 0; i < levels.length; i += 10) {
            const levelGroup = levels.slice(i, i + 10);
            embed.addFields({
                name: `📈 **Niveles ${i + 1} a ${i + 10}**`,
                value: levelGroup.map(lvl => `- **Nivel ${lvl.level}**: \`${Math.round(lvl.bipCoins)} Bip!Coins\``).join('\n'),
                inline: false
            });
        }

        await interaction.reply({ embeds: [embed] });
    }
}

module.exports = new NivelesCommand();