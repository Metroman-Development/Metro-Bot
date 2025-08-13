const { EmbedBuilder } = require('discord.js');

module.exports = {
    parentCommand: 'who',

    data: (subcommand) => subcommand
        .setName('roles')
        .setDescription('Muestra los roles de un usuario')
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

        const roles = member.roles.cache
            .filter(role => role.id !== interaction.guild.roles.everyone.id)
            .sort((a, b) => b.position - a.position)
            .map(role => role.toString())
            .join(' ') || '❌ Sin roles especiales';

        const embed = new EmbedBuilder()
            .setTitle(`🎭 Roles de ${user.username} (${member.roles.cache.size - 1})`)
            .setDescription(roles)
            .setColor('#009688')
            .setFooter({
                text: `Solicitado por ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL()
            });

        await interaction.reply({ embeds: [embed] });
    }
};
