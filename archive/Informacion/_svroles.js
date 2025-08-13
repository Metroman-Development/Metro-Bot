const { EmbedBuilder } = require('discord.js');

module.exports = {
    parentCommand: 'servidor',
    
    data: (subcommand) => subcommand
        .setName('roles')
        .setDescription('Muestra la lista de roles del servidor'),

    async execute(interaction) {
        const guild = interaction.guild;
        const roles = guild.roles.cache
            .sort((a, b) => b.position - a.position)
            .map(role => role.toString())
            .join(' ');
        
        const embed = new EmbedBuilder()
            .setTitle(`🎭 Roles de ${guild.name} (${guild.roles.cache.size})`)
            .setDescription(roles.length > 4096 ? 'Demasiados roles para mostrar.' : roles)
            .setColor('#9C27B0')
            .setFooter({ text: `Solicitado por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });
            
        await interaction.reply({ embeds: [embed] });
    }
};