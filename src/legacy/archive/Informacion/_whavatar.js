const { EmbedBuilder } = require('discord.js');

module.exports = {
    parentCommand: 'who',

    data: (subcommand) => subcommand
        .setName('avatar')
        .setDescription('Muestra el avatar de un usuario')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario a consultar')
                .setRequired(false)
        ),

    async execute(interaction) {
        const user = interaction.options.getUser('usuario') || interaction.user;
        const avatarURL = user.displayAvatarURL({
            dynamic: true,
            size: 4096,
            extension: user.avatar?.startsWith('a_') ? 'gif' : 'png'
        });

        const embed = new EmbedBuilder()
            .setTitle(`🖼️ Avatar de ${user.username}`)
            .setImage(avatarURL)
            .setColor('#009688')
            .setFooter({
                text: `Solicitado por ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .addFields({
                name: '🔗 Enlaces',
                value: `[PNG](${user.displayAvatarURL({ size: 4096 })}) | [JPG](${user.displayAvatarURL({ size: 4096, extension: 'jpg' })}) | [WEBP](${user.displayAvatarURL({ size: 4096, extension: 'webp' })})${user.avatar?.startsWith('a_') ? ` | [GIF](${avatarURL})` : ''}`
            });

        await interaction.reply({ embeds: [embed] });
    }
};
