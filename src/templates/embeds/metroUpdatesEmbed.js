const { EmbedBuilder } = require('discord.js');
const metroConfig = require('../../config/metro/metroConfig.js');
const { getStatusSummary, getNetworkStatus } = require('../../core/metro/core/services/ChangeDetector.js');
const { getLineEmoji, decorateStation } = require('../../utils/stringUtils');

function networkStatusSummary(metroData) {
    const summary = getStatusSummary();
    const networkStatus = getNetworkStatus();
    const statusInfo = metroConfig.statusTypes[networkStatus] || { emoji: '🔵', description: 'Estado desconocido' };

    const embed = new EmbedBuilder()
        .setDescription(`${statusInfo.emoji} **${statusInfo.description}**`)
        .setColor(getStatusColor(networkStatus));

    if (networkStatus !== 1) {
        Object.entries(summary.messages).forEach(([msgKey, msgData]) => {
            const lines = msgData.lines.map(l => 
                `${getLineEmoji(l.line)} L${l.line.replace('l', '')}`
            ).join(', ');

            const stations = Object.entries(msgData.stations).map(([line, stations]) => {
                return `L${line}: ${stations.map(s => decorateStation(s, { line })).join(', ')}`;
            }).join('\n');

            embed.addFields({
                name: `🔹 ${msgKey}`,
                value: `📌 **Líneas:** ${lines}\n🚉 **Estaciones:**\n${stations}`,
                inline: false
            });
        });
    }

    return { data: { description: `${statusInfo.emoji} ${statusInfo.message}` }, embed };
}

function getStatusColor(status) {
    const colors = {
        0: '#000000', // Black for closed
        1: '#00FF00', // Green for operational
        2: '#FF0000', // Red for closed stations
        3: '#FFFF00', // Yellow for partial
        4: '#FFA500', // Orange for delays
        5: '#800080'  // Purple for extended
    };
    return colors[status] || '#0099FF';
}

module.exports = {
    serviceAnnouncement: (type, statusMessage, schedule, metroData) => {
        const embed = new EmbedBuilder()
            .setTitle(type === 'start' ? '🚇 Inicio del Servicio' : '🚇 Fin del Servicio')
            .setDescription(type === 'start' 
                ? '✨ El servicio de Metro ha comenzado. ¡Buen viaje!' 
                : '😴 El servicio está finalizando. ¡Hasta mañana!')
            .setColor(type === 'start' ? '#00FF00' : '#FF0000')
            .addFields({
                name: `${metroConfig.routeStyles.comun.emoji} Horario`,
                value: `\`\`\`${schedule}\`\`\``
            });

        if (type === 'start') {
            const { embed: statusEmbed } = networkStatusSummary(metroData);
            embed.addFields(statusEmbed.data.fields);
        }

        return embed.setFooter({ text: 'Actualizado' }).setTimestamp();
    },

    expressAnnouncement: (period, type, statusMessage, metroData) => {
        const embed = new EmbedBuilder()
            .setTitle(type === 'start'
                ? `🚄 Inicio de Ruta Expresa (${period === 'EXPRESS_MORNING' ? 'Mañana' : 'Tarde'})`
                : `👋 Fin de Ruta Expresa`)
            .setDescription(type === 'start'
                ? `💫 Rutas Expresas activas en ${metroConfig.expressLines.map(l => getLineEmoji(l)).join(' ')}`
                : 'Las Rutas Expresas han finalizado')
            .setColor('#FFFF00');

        const { embed: statusEmbed } = networkStatusSummary(metroData);
        embed.addFields(statusEmbed.data.fields);
        
        return embed.setFooter({ text: 'Actualizado' }).setTimestamp();
    },

    farePeriodAnnouncement: (period, type, statusMessage, schedule) => {
        return new EmbedBuilder()
            .setTitle(`ℹ️ ${type === 'start' ? 'Inicio' : 'Fin'} del Horario ${period}`)
            .setDescription(type === 'start'
                ? `👉 Horario ${period} activo`
                : `Horario ${period} finalizado`)
            .setColor(getStatusColor(period === 'PUNTA' ? 4 : 1))
            .addFields({
                name: `${metroConfig.routeStyles.comun.emoji} Horario`,
                value: `\`\`\`${schedule}\`\`\``
            })
            .setFooter({ text: 'Actualizado' }).setTimestamp();
    },

    eventAnnouncement: (eventData, statusMessage) => {
        return new EmbedBuilder()
            .setTitle(`🎉 ${eventData.name || 'Evento Especial'}`)
            .setDescription(`⏰ ${eventData.opening} - ${eventData.closing}\n\n${statusMessage}`)
            .setColor('#FFA500')
            .addFields({
                name: 'Estaciones afectadas',
                value: eventData.stations || 'No especificadas'
            })
            .setFooter({ text: 'Actualizado' }).setTimestamp();
    },

    statusUpdateEmbed: (statusMessage, metroData, title = 'Actualización de Estado') => {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(statusMessage)
            .setColor('#0099FF');

        const { embed: statusEmbed } = networkStatusSummary(metroData);
        if (statusEmbed.data.fields) {
            embed.addFields(statusEmbed.data.fields);
        }

        return embed.setFooter({ text: 'Actualizado' }).setTimestamp();
    }
};