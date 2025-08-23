const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const metroConfig = require('../../../../../config/metro/metroConfig');
const styles = require('../../../../../config/styles.json');
const TimeHelpers = require('../../../../../core/chronos/timeHelpers');
const MetroInfoProvider = require('../../../../../utils/MetroInfoProvider');

module.exports = {
    parentCommand: 'metro',
    data: (subcommand) => subcommand
        .setName('estado')
        .setDescription('Muestra el estado del Metro de Santiago'),

    async execute(interaction, metro) {
        try {
            
            await interaction.deferReply();
            // Get and validate raw data
            const allData = MetroInfoProvider.getFullData();
            
            if (!allData || !allData.network) {
                throw new Error('No se pudo obtener datos del Metro');
            }

            const { network, lines = {} } = allData;
            const { details = {}, summary = {} } = network;

            // Get current fare period and express status
            const currentPeriod = TimeHelpers.getCurrentPeriod();
            const isExpressActive = TimeHelpers.isExpressActive();
            const operatingHours = TimeHelpers.getOperatingHours();

            // Status mapping configuration
            const STATUS_MAP = new Map([
                [0, { emoji: '🌙', display: 'Cerrado (Fuera de horario)', color: '#95a5a6' }],
                [1, { emoji: '✅', display: 'Operativa', color: '#2ecc71' }],
                [2, { emoji: '🚧', display: 'Cerrada', color: '#e74c3c' }],
                [3, { emoji: '🔧', display: 'Servicio Parcial', color: '#f39c12' }],
                [4, { emoji: '⚠️', display: 'Retrasos', color: '#e67e22' }],
                [5, { emoji: '⏱️', display: 'Servicio Extendido', color: '#4CAF50' }],
                ['unknown', { emoji: '❓', display: 'Estado Desconocido', color: '#95a5a6' }]
            ]);

            // Create main embed
            const embed = new EmbedBuilder()
                .setTitle(`${metroConfig.logoMetroEmoji} Estado del Metro de Santiago`)
                .setColor(styles.defaultTheme.primaryColor)
                .setDescription(
                    `**Estado General:** ${network.status || 'Desconocido'}\n` +
                    `📝 ${summary.es?.resumen || summary.en?.summary || 'Sin información adicional'}\n\n` +
                    `⏰ **Período Tarifario:** ${currentPeriod.name}\n` +
                    `🚄 **Servicio Expreso:** ${isExpressActive ? 'ACTIVO' : 'No activo'}\n` +
                    `🕒 **Horario:** ${operatingHours.opening} - ${operatingHours.closing}` +
                    (operatingHours.isExtended ? ` (Extendido)` : '')
                );

            // Process all lines
            const lineEntries = Object.entries(lines);
            if (lineEntries.length > 0) {
                const lineStatuses = lineEntries.map(([lineId, lineData]) => {
                    const lineEmoji = metroConfig.linesEmojis[lineId.toLowerCase()] || '🚇';
                    const lineStatus = lineData.status || {};
                    const statusCode = lineStatus.code || '1';
                    const statusInfo = STATUS_MAP.get(parseInt(statusCode)) || STATUS_MAP.get('unknown');
                    
                    // Check if line is express and if express service is active
                    const isExpressLine = metroConfig.expressLines.includes(lineId.toLowerCase());
                    const expressIndicator = (isExpressLine && isExpressActive) ? ' 🚄' : '';
                    
                    const lineName = lineData.displayName || `Línea ${lineId.toUpperCase().replace('L', '')}`;
                    
                    return `${lineEmoji} **${lineName}${expressIndicator}:** ${statusInfo.emoji} ${statusInfo.display}` +
                           (lineStatus.message ? `\n• ${lineStatus.message}` : '');
                });

                embed.addFields({
                    name: '🚇 Estado de Líneas',
                    value: lineStatuses.join('\n\n') || 'No se pudo obtener información de las líneas',
                    inline: false
                });
            }

            // Add timestamp
            embed.setFooter({ 
                text: `Actualizado: ${this.formatTimestamp(network.timestamp)}`,
                iconURL: 'https://cdn.discordapp.com/emojis/1349494723760492594.webp'
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error en comando estado:', error);
            await interaction.editReply({
                content: '❌ Ocurrió un error al obtener el estado del Metro. Por favor intenta nuevamente.',
                ephemeral: true
            });
        }
    },

    formatTimestamp(timestamp) {
        if (!timestamp) return 'Desconocido';
        
        // Fix malformed timestamp if needed
        let fixedTimestamp = timestamp;
        if (timestamp.length > 23 && !timestamp.includes('T')) {
            fixedTimestamp = timestamp.substring(0, 10) + 'T' + timestamp.substring(11);
        }
        
        try {
            const date = new Date(fixedTimestamp);
            return date.toLocaleString('es-CL', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Santiago'
            });
        } catch (e) {
            return fixedTimestamp;
        }
    }
};