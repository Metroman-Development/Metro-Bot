// slashCommands/userInfo.js

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('whois')

        .setDescription('Muestra información sobre un usuario.')

        .addUserOption(option =>

            option.setName('usuario')

                .setDescription('El usuario del que quieres ver la información.')

                .setRequired(false)), // Make the option optional

    category: "Información", 
    
    async execute(interaction) {

        // If no user is specified, default to the interaction author

        const user = interaction.options.getUser('usuario') || interaction.user;

        const member = interaction.guild.members.cache.get(user.id);

        if (!member) {

            return await interaction.reply({ content: '❌ El usuario no está en este servidor.', ephemeral: true });

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

        await interaction.followUp({ embeds: [embed] });

    },

}; 