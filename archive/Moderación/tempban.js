const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const moderationSystem = require('../../utils/moderationSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tempban')
        .setDescription('Banea temporalmente a un usuario.')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('El usuario a banear temporalmente')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('duración')
                .setDescription('Duración del baneo en días')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('razón')
                .setDescription('La razón del baneo temporal')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers) // Only users with BanMembers permission can use this
        .setDMPermission(false), // Cannot be used in DMs
    async execute(interaction, client) {
        // Check if the user has the moderator role
        if (!interaction.member.roles.cache.has('1353451767446241444')) {
            return interaction.followUp({ content: '❌ No tienes permiso para usar este comando.', ephemeral: true });
        }

        const user = interaction.options.getUser('usuario');
        const duration = interaction.options.getInteger('duración');
        const reason = interaction.options.getString('razón') || 'No se proporcionó una razón.';

        try {
            await interaction.deferReply({ ephemeral: true }); // Defer the reply
            await moderationSystem.tempBanUser(user.id, interaction.user.id, reason, duration * 24 * 60 * 60 * 1000, client); // Convert days to milliseconds
            await interaction.followUp({ content: `✅ Usuario ${user.tag} ha sido baneado temporalmente por ${duration} días. Razón: ${reason}`, ephemeral: true });
        } catch (error) {
            await interaction.followUp({ content: '❌ No se pudo banear temporalmente al usuario.', ephemeral: true });
        }
    },
};