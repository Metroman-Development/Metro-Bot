// slashCommands/userRoles.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whoroles')
        .setDescription('Muestra los roles de un usuario.')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('El usuario del que quieres ver los roles.')
                .setRequired(false)), // Make the option optional
    
    category: "Información", 
    
    async execute(interaction) {
        // If no user is specified, default to the interaction author
        const user = interaction.options.getUser('usuario') || interaction.user;
        const member = interaction.guild.members.cache.get(user.id);

        if (!member) {
            return await interaction.reply({ content: '❌ El usuario no está en este servidor.', ephemeral: true });
        }

        const roles = member.roles.cache
            .filter(role => role.name !== '@everyone')
            .map(role => role.name)
            .join(', ');

        const embed = new EmbedBuilder()
            .setTitle(`🎭 Roles de ${user.username}`)
            .setDescription(roles || 'Este usuario no tiene roles.')
            .setColor('#009688')
            .setFooter({ text: `Solicitado por ${interaction.user.username}` });

        await interaction.followUp({ embeds: [embed] });
    },
};