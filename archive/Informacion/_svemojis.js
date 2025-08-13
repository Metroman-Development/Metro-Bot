const { EmbedBuilder } = require('discord.js');

module.exports = {
    parentCommand: 'servidor',
    
    data: (subcommand) => subcommand
        .setName('emojis')
        .setDescription('Muestra la lista de emojis del servidor'),

    async execute(interaction) {
        const guild = interaction.guild;
        const emojis = guild.emojis.cache;
        
        const animated = emojis.filter(e => e.animated).size;
        const staticEmojis = emojis.filter(e => !e.animated).size;
        
        const embed = new EmbedBuilder()
            .setTitle(`😄 Emojis de ${guild.name} (${emojis.size})`)
            .setColor('#E91E63')
            .addFields(
                { name: '🖼️ Estáticos', value: staticEmojis.toString(), inline: true },
                { name: '🎬 Animados', value: animated.toString(), inline: true }
            )
            .setFooter({ text: `Solicitado por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });
            
        // Add emoji list if not too many
        if (emojis.size <= 25) {
            embed.addFields({
                name: '📋 Lista',
                value: emojis.map(e => e.toString()).join(' ')
            });
        }
            
        await interaction.reply({ embeds: [embed] });
    }
};