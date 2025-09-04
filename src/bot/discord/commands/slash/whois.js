const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const BaseCommand = require('../BaseCommand');

class WhoisCommand extends BaseCommand {
    constructor() {
        super(new SlashCommandBuilder()
            .setName('whois')
            .setDescription('Muestra información sobre un usuario.')
            .addUserOption(option =>
                option.setName('usuario')
                    .setDescription('El usuario del que quieres ver la información.')
                    .setRequired(false)
            )
        );
        this.category = "Información";
    }

    async execute(interaction) {
        const user = interaction.options.getUser('usuario') || interaction.user;
        const member = interaction.guild.members.cache.get(user.id);

        if (!member) {
            return await interaction.reply({ content: '❌ El usuario no está en este servidor.' });
        }

        const embed = new EmbedBuilder()
            .setTitle(`🖥️ Información de ${user.username}`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🆔 ID', value: user.id, inline: true },
                { name: '📅 Fecha de Creación', value: user.createdAt.toLocaleDateString(), inline: true },
                { name: '📅 Fecha de Unión', value: member.joinedAt.toLocaleDateString(), inline: true },
                { name: '🎭 Roles', value: member.roles.cache.size.toString(), inline: true },
                { name: '👑 Rol Más Alto', value: member.roles.highest.name, inline: true },
                { name: '🤖 Bot', value: user.bot ? 'Sí' : 'No', inline: true },
            )
            .setColor('#009688')
            .setFooter({ text: `Solicitado por ${interaction.user.username}` });

        await interaction.reply({ embeds: [embed] });
    }
}

module.exports = new WhoisCommand();