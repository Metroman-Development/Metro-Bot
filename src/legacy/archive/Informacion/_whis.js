const { EmbedBuilder } = require('discord.js');

module.exports = {
    parentCommand: 'who',

    data: (subcommand) => subcommand
        .setName('is')
        .setDescription('Muestra información detallada de un usuario')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario a consultar')
                .setRequired(false)
        ),

    async execute(interaction) {
        const user = interaction.options.getUser('usuario') || interaction.user;
        const member = interaction.guild.members.cache.get(user.id) ||
                       await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) {
            return interaction.reply({
                content: '❌ El usuario no está en este servidor.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`🖥️ Información de ${user.username}`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🆔 ID', value: `\`${user.id}\``, inline: true },
                { name: '📅 Creación', value: `<t:${Math.floor(user.createdAt.getTime()/1000)}:R>`, inline: true },
                { name: '📅 Unión', value: `<t:${Math.floor(member.joinedAt.getTime()/1000)}:R>`, inline: true },
                { name: '🎭 Roles', value: `\`${member.roles.cache.size - 1}\``, inline: true },
                { name: '👑 Rol Superior', value: member.roles.highest.toString(), inline: true },
                { name: '🤖 Bot', value: user.bot ? '✅ Sí' : '❌ No', inline: true }
            )
            .setColor('#009688')
            .setFooter({
                text: `Solicitado por ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL()
            });

        await interaction.reply({ embeds: [embed] });
    }
};
