const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const BaseCommand = require('../BaseCommand');

class WhoAvatarCommand extends BaseCommand {
    constructor() {
        super(new SlashCommandBuilder()
            .setName('whoavatar')
            .setDescription('Muestra el avatar de un usuario.')
            .addUserOption(option =>
                option.setName('usuario')
                    .setDescription('El usuario del que quieres ver el avatar.')
                    .setRequired(false)
            )
        );
        this.category = "Información";
    }

    async execute(interaction) {
        const user = interaction.options.getUser('usuario') || interaction.user;

        const embed = new EmbedBuilder()
            .setTitle(`🖼️ Avatar de ${user.username}`)
            .setImage(user.displayAvatarURL({ dynamic: true, size: 4096 }))
            .setColor('#009688')
            .setFooter({ text: `Solicitado por ${interaction.user.username}` });

        await interaction.reply({ embeds: [embed] });
    }
}

module.exports = new WhoAvatarCommand();