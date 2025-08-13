const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const moderationSystem = require('../../../utils/moderationSystem.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban-nodelete')
        .setDescription('Banea a un usuario sin eliminar sus mensajes.')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('El usuario a banear')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('razón')
                .setDescription('La razón del ban')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers) // Only users with BanMembers permission can use this
        .setDMPermission(false), // Cannot be used in DMs
    async execute(interaction, client) {
        // Check if the user has the moderator role
        if (!interaction.member.roles.cache.has('1353451767446241444')) {
            return interaction.reply({ content: '❌ No tienes permiso para usar este comando.', ephemeral: true });
        }

        const user = interaction.options.getUser('usuario');
        const reason = interaction.options.getString('razón') || 'No se proporcionó una razón.';

        try {
            await moderationSystem.banUserWithoutDeleting(user.id, interaction.user.id, reason, client);
            await interaction.reply({ content: `✅ Usuario ${user.tag} ha sido baneado (sin eliminar mensajes). Razón: ${reason}`, ephemeral: true });
        } catch (error) {
            await interaction.reply({ content: '❌ No se pudo banear al usuario.', ephemeral: true });
        }
    },
};
