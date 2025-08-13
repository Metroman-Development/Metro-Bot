const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const moderationSystem = require('../../../utils/moderationSystem.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Expulsa a un usuario del servidor.')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('El usuario a expulsar')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('razón')
                .setDescription('La razón de la expulsión')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers) // Only users with KickMembers permission can use this
        .setDMPermission(false), // Cannot be used in DMs
    async execute(interaction, client) {
        // Check if the user has the moderator role
        if (!interaction.member.roles.cache.has('1353451767446241444')) {
            return interaction.followUp({ content: '❌ No tienes permiso para usar este comando.', ephemeral: true });
        }

        const user = interaction.options.getUser('usuario');
        const reason = interaction.options.getString('razón') || 'No se proporcionó una razón.';

        try {
            await moderationSystem.kickUser(user.id, interaction.user.id, reason, client);
            await interaction.followUp({ content: `✅ Usuario ${user.tag} ha sido expulsado. Razón: ${reason}`, ephemeral: true });
        } catch (error) {
            await interaction.followUp({ content: '❌ No se pudo expulsar al usuario.', ephemeral: true });
        }
    },
};
