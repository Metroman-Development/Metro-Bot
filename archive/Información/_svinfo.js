const { EmbedBuilder } = require('discord.js');

module.exports = {
    parentCommand: 'servidor',
    
    data: (subcommand) => subcommand
        .setName('info')
        .setDescription('Muestra información general del servidor'),

    async execute(interaction) {
        const guild = interaction.guild;
        const owner = await guild.fetchOwner();
        
        const embed = new EmbedBuilder()
            .setTitle(`ℹ️ Información de ${guild.name}`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .setColor('#4CAF50')
            .addFields(
                { name: '👑 Dueño', value: owner.user.tag, inline: true },
                { name: '🆔 ID', value: guild.id, inline: true },
                { name: '📅 Creado', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
                { name: '👥 Miembros', value: guild.memberCount.toString(), inline: true },
                { name: '💬 Canales', value: guild.channels.cache.size.toString(), inline: true },
                { name: '🎭 Roles', value: guild.roles.cache.size.toString(), inline: true },
                { name: '✨ Nivel de Boost', value: `Nivel ${guild.premiumTier} (${guild.premiumSubscriptionCount} boosts)`, inline: true },
                { name: '🖼️ Icono', value: guild.iconURL() ? `[Enlace](${guild.iconURL({ dynamic: true, size: 4096 })})` : 'Sin icono', inline: true }
            )
            .setFooter({ text: `Solicitado por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });
            
        await interaction.reply({ embeds: [embed] });
    }
};