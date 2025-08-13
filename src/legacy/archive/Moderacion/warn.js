const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const moderationSystem = require('../../../utils/moderationSystem.js');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('warn')

        .setDescription('Advierte a un usuario.')

        .addUserOption(option =>

            option.setName('usuario')

                .setDescription('El usuario a advertir')

                .setRequired(true))

        .addStringOption(option =>

            option.setName('razón')

                .setDescription('La razón de la advertencia')

                .setRequired(false))

        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers) // Only users with ModerateMembers permission can use this

        .setDMPermission(false), // Cannot be used in DMs

    async execute(interaction, client) {

        // Check if the user has the moderator role

        if (!interaction.member.roles.cache.has('1353451767446241444')) {

            return interaction.followUp({ content: '❌ No tienes permiso para usar este comando.', ephemeral: true });

        }

        const user = interaction.options.getUser('usuario');

        const reason = interaction.options.getString('razón') || 'No se proporcionó una razón.';

        try {

            await moderationSystem.warnUser(user.id, interaction.user.id, reason, client);

            await interaction.followUp({ content: `✅ Usuario ${user.tag} ha sido advertido. Razón: ${reason}`, ephemeral: true });

        } catch (error) {

            await interaction.followUp({ content: '❌ No se pudo advertir al usuario.', ephemeral: true });

        }

    },

};
