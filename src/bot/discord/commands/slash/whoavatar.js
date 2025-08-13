// slashCommands/userAvatar.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whoavatar')
        .setDescription('Muestra el avatar de un usuario.')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('El usuario del que quieres ver el avatar.')
                .setRequired(false)), // Make the option optional
    
    category: "Información", 
    
    async execute(interaction) {
        // If no user is specified, default to the interaction author
        const user = interaction.options.getUser('usuario') || interaction.user;

        const embed = new EmbedBuilder()
            .setTitle(`🖼️ Avatar de ${user.username}`)
            .setImage(user.displayAvatarURL({ dynamic: true, size: 4096 }))
            .setColor('#009688')
            .setFooter({ text: `Solicitado por ${interaction.user.username}` });

        await interaction.followUp({ embeds: [embed] });
    },
};