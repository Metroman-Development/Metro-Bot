const { EmbedBuilder } = require('discord.js');

module.exports = {
    parentCommand: 'servidor',
    
    data: (subcommand) => subcommand
        .setName('canales')
        .setDescription('Muestra la lista de canales del servidor'),

    async execute(interaction) {
        const guild = interaction.guild;
        
        const textChannels = guild.channels.cache.filter(c => c.isTextBased()).size;
        const voiceChannels = guild.channels.cache.filter(c => c.isVoiceBased()).size;
        const categories = guild.channels.cache.filter(c => c.type === 4).size;
        
        const embed = new EmbedBuilder()
            .setTitle(`💬 Canales de ${guild.name}`)
            .setColor('#2196F3')
            .addFields(
                { name: '📝 Texto', value: textChannels.toString(), inline: true },
                { name: '🎙️ Voz', value: voiceChannels.toString(), inline: true },
                { name: '📂 Categorías', value: categories.toString(), inline: true },
                { name: '📊 Total', value: guild.channels.cache.size.toString(), inline: true }
            )
            .setFooter({ text: `Solicitado por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });
            
        await interaction.reply({ embeds: [embed] });
    }
};