const { EmbedBuilder } = require('discord.js');

module.exports = {
    parentCommand: 'servidor',

    data: (subcommand) => subcommand
        .setName('members')
        .setDescription('Muestra estadísticas de miembros del servidor'),

    async execute(interaction) {

        await interaction.guild.members.fetch(); // This forces a cache update

        const guild = interaction.guild;

        // Count different member statuses
        const online = guild.members.cache.filter(m => m.presence?.status === 'online').size;
        const idle = guild.members.cache.filter(m => m.presence?.status === 'idle').size;
        const dnd = guild.members.cache.filter(m => m.presence?.status === 'dnd').size;
        const offline = guild.members.cache.filter(m => !m.presence || m.presence.status === 'offline').size;

        // Count bots
        const bots = guild.members.cache.filter(m => m.user.bot).size;
        const humans = guild.memberCount - bots;

        const embed = new EmbedBuilder()
            .setTitle(`👥 Miembros de ${guild.name}`)
            .setColor('#FF9800')
            .addFields(
                { name: '👤 Humanos', value: humans.toString(), inline: true },
                { name: '🤖 Bots', value: bots.toString(), inline: true },
                { name: '🟢 En línea', value: online.toString(), inline: true },
                { name: '🟡 Ausente', value: idle.toString(), inline: true },
                { name: '🔴 No molestar', value: dnd.toString(), inline: true },
                { name: '⚫ Desconectado', value: offline.toString(), inline: true },
                { name: '📊 Total', value: guild.memberCount.toString(), inline: true }
            )
            .setFooter({ text: `Solicitado por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed] });
    }
};
