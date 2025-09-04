const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const BaseCommand = require('../BaseCommand');
const bipConfig = require('../../../../config/bipConfig');

class PremiosActividadCommand extends BaseCommand {
    constructor() {
        super(new SlashCommandBuilder()
            .setName('premiosactividad')
            .setDescription('Explica cómo ganar Bip!Coins a través de actividades')
        );
        this.category = "Bip!Coin";
    }

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('💰 **Sistema de Bip!Coins**')
            .setDescription('Aquí te explicamos cómo puedes ganar **Bip!Coins** y mejorar tu rango en el servidor:')
            .setColor(0x0099FF)
            .addFields(
                {
                    name: '📝 **Mensajes**',
                    value: `Envía mensajes en el servidor para ganar **${bipConfig.BASE_POINTS.message} Bip!Coins** por mensaje.`,
                    inline: true
                },
                {
                    name: '🛠️ **Comandos**',
                    value: `Usa comandos en el servidor para ganar **${bipConfig.BASE_POINTS.command} Bip!Coins** por comando.`,
                    inline: true
                },
                {
                    name: '🎙️ **Voz**',
                    value: `Participa en canales de voz para ganar **${bipConfig.BASE_POINTS.voice} Bip!Coins** por minuto.`,
                    inline: true
                },
                {
                    name: '🔥 **Racha Diaria**',
                    value: 'Mantén una racha de actividad diaria para ganar bonificaciones exponenciales.',
                    inline: true
                },
                {
                    name: '🌟 **Primera Actividad del Día**',
                    value: `Gana **${bipConfig.FIRST_ACTIVITY_BONUS} Bip!Coins** adicionales por tu primera actividad del día.`,
                    inline: true
                },
                {
                    name: '📊 **Niveles**',
                    value: 'Sube de nivel acumulando Bip!Coins. Cada nivel requiere más Bip!Coins que el anterior.',
                    inline: true
                }
            )
            .setFooter({ text: '¡Participa activamente y conviértete en una Leyenda del Metro!' });

        await interaction.reply({ embeds: [embed] });
    }
}

module.exports = new PremiosActividadCommand();