const { EmbedBuilder } = require('discord.js');
const statusEmbeds = require('../config/statusEmbeds');
const metroConfig = require('../config/metroConfig');
const styles = require('../config/styles');
const { 
  decorateStation,
  formatLineString,
  formatEmbedTimestamp, 
  getLineEmoji,
  extractLineNumber,
} = require('../utils/stringUtils');
const { formatStationRanges } = require('../utils/stationUtils'); // Added this import
const logger = require('../events/logger');
const changeDetector = require('./changeDetector');
// In embedManager.js

const timeUtils = require('../utils/timeUtils'); // Add this import at the top
const metroDataHandler = require('../events/metroDataHandler');
const { validateAgainstTemplate } = require('../database/dataValidators');

const processStations = async (lineKey, estacionesArray) => {
  if (!Array.isArray(estacionesArray)) return [];
  
  const stations = await Promise.all(
    estacionesArray.map(async (station) => {
      if (!station?.nombre) return null;
      
      const decoratedName = await decorateStation(station.nombre, {
        line: lineKey,
        estado: station.estado,
        ruta: true,
        combinacion: !!station.combinacion,
        conexiones: true
      });
      
      return {
        originalName: station.nombre,
        displayName: decoratedName,
        status: {
          code: station.estado,
          message: station.descripcion,
          isTransfer: !!station.combinacion
        }
      };
    })
  );
  
  return stations.filter(Boolean);
};

const createStatusEmbed = (embedData, lineKey = null) => {
  const embed = new EmbedBuilder()
    .setTitle(embedData.title)
    .setColor(embedData.color || (lineKey ? styles.lineColors[lineKey] : metroConfig.statusMapping['1'].color));

  if (embedData.description) embed.setDescription(embedData.description);

  if (embedData.isOverview) {
    embed.addFields([
      {
        name: 'Leyenda de Estados',
        value: [
          `${metroConfig.statusMapping['1'].emoji}/${metroConfig.stationIcons['1'].emoji} Operativo`,
          `${metroConfig.statusMapping['2'].emoji}/${metroConfig.stationIcons['2'].emoji} Cerrado`,
          `${metroConfig.statusMapping['3'].emoji}/${metroConfig.stationIcons['3'].emoji} Cierre parcial`,
          `${metroConfig.statusMapping['4'].emoji} Retrasos`,
          '↔️ Estación de transferencia'
        ].join('\n'),
        inline: true
      },
      {
        name: 'Leyenda de Conexiones',
        value: Object.entries(metroConfig.connectionEmojis)
          .map(([name, emoji]) => `${emoji} ${name}`)
          .join('\n'),
        inline: true
      }
    ]);
  }

  if (embedData.fields?.length) {
    embed.addFields(embedData.fields.map(field => ({
      ...field,
      value: field.value.length > 1024 ? `${field.value.substring(0, 1020)}...` : field.value
    })));
  }

  embed.setFooter({
    text: `${embedData.footer?.text || ''} • ${formatEmbedTimestamp()}`,
    iconURL: metroConfig.metroLogo.principal
  });

  return embed;
};


const updateLineEmbeds = async (client, data) => {
  for (const [lineKey, lineData] of Object.entries(data)) {
    try {
      if (!lineData?.estaciones) {
        logger.warn(`No hay datos de estaciones para la línea ${lineKey}`);
        continue;
      }

      const processedStations = await processStations(lineKey, lineData.estaciones);
      const stationsList = processedStations.map(s => s.displayName).join('\n') || 'No hay datos de estaciones';

      const statusSummary = changeDetector.getStatusSummary();
      const lineCode = lineKey.toUpperCase();
      
      let lineStatus = `${metroConfig.statusMapping['1'].emoji} Toda la Línea Operativa`;
      for (const [message, details] of Object.entries(statusSummary.messages)) {
        if (details.lines.some(l => l.line === lineCode) || details.stations[lineCode]) {
          const estado = details.lines.find(l => l.line === lineCode)?.estado || 
                        details.stations[lineCode]?.[0]?.estado || 1;
          lineStatus = `${metroConfig.statusMapping[estado]?.emoji || 'ℹ️'} ${message}`;
          break;
        }
      }

      // Check if express route is active for this line
      let expressStatus = '';
      if (timeUtils.isExpressActive() && metroConfig.expressLines.includes(lineKey)) {
        expressStatus = '\n🚄 Ruta Expresa Operativa';
      }

      const embed = createStatusEmbed({
        title: `📌 Estado de Línea ${getLineEmoji(lineKey)}`,
        description: [
          `**Estado:** ${lineStatus}${expressStatus}`,
          '',
          `**Estaciones:**`,
          stationsList
        ].join('\n'),
        color: styles.lineColors[lineKey]
      }, lineKey);

      const channel = await client.channels.fetch(metroConfig.embedsChannelId);
      const message = await channel.messages.fetch(metroConfig.embedMessageIds[lineKey]);
      await message.edit({ embeds: [embed] });

    } catch (error) {
      logger.error(`Error al actualizar la línea ${lineKey}: ${error.message}`);
    }
  }
};


const updateOverviewEmbed = async (client, data) => {
  try {
    // Validate input data
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Invalid data format - expected object');
    }

    // Safely get status information
    const statusSummary = changeDetector?.getStatusSummary() || {};
    const networkStatus = changeDetector?.getNetworkStatus() || 'unknown';
    const isNetworkClosed = timeUtils?.isOutsideOperatingHours(metroConfig.horario) || false;

    // Get status display information
    const statusInfo = isNetworkClosed
      ? { emoji: '🌙', message: 'Cierre por Horario' }
      : metroConfig.NETWORK_STATUS_MAP[networkStatus] || { 
          emoji: 'ℹ️', 
          message: 'Estado desconocido' 
        };

    // Process active issues
    const activeIssues = [];
    if (!isNetworkClosed && statusSummary.messages) {
      Object.entries(statusSummary.messages).forEach(([message, details]) => {
        try {
          const affectedLines = details.lines
            ? [...new Set(details.lines.map(l => l.line || ''))].filter(Boolean).join(', ')
            : '';

          const stationList = details.stations
            ? Object.values(details.stations).flatMap(stations => 
                stations.map(s => s.station).filter(Boolean)) 
          
            : [];

          const formattedStations = stationList.length > 0 
            ? formatStationRanges(stationList) 
            : '';

          let issueText = `• ${message}`;
          if (affectedLines) issueText += ` (Líneas: ${affectedLines})`;
          if (formattedStations) issueText += `\n   Estaciones afectadas: ${formattedStations}`;

          activeIssues.push(issueText);
        } catch (error) {
          logger.error(`Error processing issue: ${error.message}`);
        }
      });
    }

    // Process each line's status
    const linesStatus = [];
    for (const [lineKey, lineData] of Object.entries(data)) {
      try {
        if (!lineData || typeof lineData !== 'object') continue;

        const lineEmoji = getLineEmoji(lineKey) || 'ℹ️';
        const isLineClosed = lineData.estado === 0 || isNetworkClosed;

        let statusDisplay;
        if (isLineClosed) {
          statusDisplay = `${metroConfig.statusMapping['0']?.emoji || '🌙'} Cierre por Horario`;
        } else {
          // Check for line-specific issues
          let lineStatus = metroConfig.statusMapping['1']?.emoji || '🟩';
          let statusMessage = 'Toda la Línea Operativa';

          if (statusSummary.messages) {
            for (const [message, details] of Object.entries(statusSummary.messages)) {
              const lineCode = lineKey.toUpperCase();
              const hasLineIssue = details.lines?.some(l => l.line === lineCode) || 
                                 details.stations?.[lineCode];

              if (hasLineIssue) {
                const estado = details.lines?.find(l => l.line === lineCode)?.estado || 
                              details.stations[lineCode]?.[0]?.estado || '1';
                lineStatus = metroConfig.statusMapping[estado]?.emoji || 'ℹ️';
                statusMessage = message;
                break;
              }
            }
          }

          statusDisplay = `${lineStatus} ${statusMessage}`;

          // Add express indicator if needed
          if (metroConfig.expressLines?.includes(lineKey) && timeUtils?.isExpressActive()) {
            statusDisplay += ' 🚄';
          }
        }

        linesStatus.push(`${lineEmoji} ${statusDisplay}`);
      } catch (error) {
        logger.error(`Error processing line ${lineKey}: ${error.message}`);
      }
    }

    // Build the final embed description
    const descriptionParts = [
      `**Estado de la Red:** ${statusInfo.emoji} ${statusInfo.message}`,
      '',
      `**Líneas:**\n${linesStatus.join('\n')}`,
      ''
    ];

    if (isNetworkClosed) {
      descriptionParts.push('🌙 El metro se encuentra cerrado por horario. Volverá a operar mañana.');
    } else {
      descriptionParts.push(
        activeIssues.length > 0
          ? `**Incidencias Activas:**\n${activeIssues.join('\n\n')}`
          : '✅ No hay incidencias reportadas'
      );
    }

    // Create and send embed
    const embed = createStatusEmbed({
      title: '📌 Estado General de la Red',
      description: descriptionParts.join('\n'),
      isOverview: true,
      color: isNetworkClosed 
        ? (styles.closedColor || '#888888')
        : (styles.defaultColor || '#0099ff')
    });

    const channel = await client.channels.fetch(metroConfig.embedsChannelId).catch(() => null);
    if (!channel) {
      throw new Error('Failed to fetch channel');
    }

    const message = await channel.messages.fetch(metroConfig.embedMessageIds.overview).catch(() => null);
    if (!message) {
      throw new Error('Failed to fetch message');
    }

    await message.edit({ embeds: [embed] });

  } catch (error) {
    logger.error(`Critical error in overview embed: ${error.message}`);
    logger.error(error.stack);
  }
};

module.exports.initializeEmbeds = (client) => ({
  updateLineEmbeds: (data) => updateLineEmbeds(client, data),
  updateOverviewEmbed: (data) => updateOverviewEmbed(client, data)
});