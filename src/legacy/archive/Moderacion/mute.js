const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const moderationSystem = require('../../utils/moderationSystem');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('mute')

        .setDescription('Silencia a un usuario por un tiempo específico.')

        .addUserOption(option =>

            option.setName('usuario')

                .setDescription('El usuario a silenciar')

                .setRequired(true))

        .addIntegerOption(option =>

            option.setName('duración')

                .setDescription('Duración del silencio en minutos')

                .setRequired(true))

        .addStringOption(option =>

            option.setName('razón')

                .setDescription('La razón del silencio')

                .setRequired(false))

        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers) // Only users with ModerateMembers permission can use this

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

            await moderationSystem.muteUser(user.id, interaction.user.id, reason, duration * 60 * 1000, client); // Convert minutes to milliseconds

            await interaction.followUp({ content: `✅ Usuario ${user.tag} ha sido silenciado por ${duration} minutos. Razón: ${reason}`, ephemeral: true });

        } catch (error) {

            await interaction.followUp({ content: '❌ No se pudo silenciar al usuario.', ephemeral: true });

        }

    },

};
