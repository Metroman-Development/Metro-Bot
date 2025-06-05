// commands/estacioninfo.js
const { Markup } = require('telegraf');
const SearchCore = require('../../modules/metro/search/SearchCore');
const { chunkArray } = require('../../utils/arrayUtils');
const MetroCore = require('../../modules/metro/core/MetroCore');

// MetroCore instance (singleton pattern)
let metroCoreInstance = null;

async function getMetroCore() {
    if (!metroCoreInstance) {
        metroCoreInstance = await MetroCore.getInstance();
    }
    return metroCoreInstance;
}

module.exports = {
  execute: async (ctx) => {
    try {
      // Get the station query from the message
      const query = ctx.message.text.split(' ').slice(1).join(' ').trim();
      
      if (!query) {
        return ctx.reply(
          'Por favor, especifica una estación. Ejemplo: /estacioninfo Plaza de Armas',
          Markup.keyboard([['Cancelar']]).oneTime().resize()
        );
      }

      // Show loading message
      const loadingMsg = await ctx.reply('Buscando información de la estación... ⏳');
      const metro = await getMetroCore();
      const metroData = metro.api.getProcessedData();
   
      // Search for the station
      const searcher = new SearchCore('station');
      searcher.setDataSource(metroData);  const results = await searcher.search(query, { maxResults: 5 });

      const results = await searcher.search(query, { 
                maxResults: 5,
                needsOneMatch: true 
            }); 
      
      if (!results.length) {
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
        return ctx.reply(
          'No se encontró la estación especificada. Intenta con otro nombre.',
          Markup.keyboard([['Cancelar']]).oneTime().resize()
        );
      }

      // If multiple results, let user choose
      if (results.length > 1) {
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
        return ctx.reply(
          'Se encontraron varias estaciones. Por favor selecciona una:',
          Markup.inlineKeyboard(
            results.map(result => [
              Markup.button.callback(
                `${result.displayName} (L${result.line.toUpperCase()})`,
                `station_select:${result.id}`
              )
            ]),
            { columns: 1 }
          )
        );
      }

      // Single result - show station info
      await showStationInfo(ctx, results[0].id);
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
    } catch (error) {
      console.error('Error in estacioninfo command:', error);
      ctx.reply('Ocurrió un error al procesar la solicitud. Por favor intenta nuevamente.');
    }
  },
  
  // Handle button callbacks
  registerActions: (bot) => {
    // Station selection
    bot.action(/station_select:(.+)/, async (ctx) => {
      await ctx.answerCbQuery();
      await showStationInfo(ctx, ctx.match[1]);
    });
    
    // Tab navigation
    bot.action(/station_tab:(.+):(.+)/, async (ctx) => {
      await ctx.answerCbQuery();
      const [stationId, tabId] = ctx.match.slice(1);
      await showStationInfo(ctx, stationId, tabId);
    });
    
    // Accessibility sub-tabs
    bot.action(/station_acc:(.+):(.+)/, async (ctx) => {
      await ctx.answerCbQuery();
      const [stationId, subTab] = ctx.match.slice(1);
      await showStationInfo(ctx, stationId, `acc_${subTab}`);
    });
    
    // Pagination
    bot.action(/station_page:(.+):(.+):(\d+)/, async (ctx) => {
      await ctx.answerCbQuery();
      const [stationId, tabId, page] = ctx.match.slice(1);
      await showStationInfo(ctx, stationId, tabId, parseInt(page));
    });
  }
};

async function showStationInfo(ctx, stationId, tabId = 'main', page = 0) {
  try {
    // Get station data (simplified for Telegram)
    const searcher = new SearchCore('station');
    const station = await searcher.getById(stationId);
    
    if (!station) {
      return ctx.reply('No se pudo cargar la información de la estación.');
    }
    
    // Get the appropriate message content for the tab
    const { message, keyboard } = await getStationTabContent(station, tabId, page);
    
    // Edit or send the message
    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
      });
    } else {
      await ctx.replyWithHTML(message, {
        reply_markup: { inline_keyboard: keyboard }
      });
    }
  } catch (error) {
    console.error('Error showing station info:', error);
    ctx.reply('Ocurrió un error al mostrar la información de la estación.');
  }
}

async function getStationTabContent(station, tabId, page = 0) {
  const availableTabs = getAvailableTabs(station);
  const isAccessibilitySubTab = tabId.startsWith('acc_');
  
  let message = '';
  let keyboard = [];
  
  // Main tab
  if (tabId === 'main') {
    message = generateMainTabMessage(station);
  } 
  // Surroundings tab
  else if (tabId === 'surroundings') {
    message = generateSurroundingsMessage(station);
  }
  // Transfers tab
  else if (tabId === 'transfers') {
    message = generateTransfersMessage(station);
  }
  // Accessibility tabs
  else if (tabId === 'accessibility' || isAccessibilitySubTab) {
    const result = generateAccessibilityMessage(station, tabId, page);
    message = result.message;
    
    // Add pagination buttons if needed
    if (result.pages > 1) {
      keyboard.push([
        Markup.button.callback(
          '◀️ Anterior',
          `station_page:${station.id}:${tabId}:${page - 1}`,
          { hide: page <= 0 }
        ),
        Markup.button.callback(
          `Página ${page + 1}/${result.pages}`,
          'noop',
          { hide: true }
        ),
        Markup.button.callback(
          'Siguiente ▶️',
          `station_page:${station.id}:${tabId}:${page + 1}`,
          { hide: page >= result.pages - 1 }
        )
      ]);
    }
  }
  
  // Main navigation buttons
  const mainNavRow = [];
  availableTabs.filter(t => !t.startsWith('acc_')).forEach(tab => {
    const isActive = tab === tabId;
    
    // Skip transfers tab if we'll show a direct transfer button
    if (tab === 'transfers' && station.transferLines?.length) {
      return;
    }
    
    mainNavRow.push(
      Markup.button.callback(
        getTabEmoji(tab) + (isActive ? ` [${getTabName(tab)}]` : ` ${getTabName(tab)}`),
        isActive ? 'noop' : `station_tab:${station.id}:${tab}`,
        { hide: isActive }
      )
    );
});
  
  // Add direct transfer button if available
  if (station.transferLines?.length) {
    mainNavRow.push(
      Markup.button.callback(
        '🔄 Combinación',
        `station_tab:${station.id}:transfers`
      )
    );
  }
  
  keyboard.unshift(mainNavRow);
  
  // Accessibility sub-buttons
  if (availableTabs.includes('accessibility') && 
      (tabId === 'accessibility' || isAccessibilitySubTab)) {
    const accSubTabs = availableTabs.filter(t => t.startsWith('acc_'));
    const accNavRow = [];
    
    accSubTabs.forEach(subTab => {
      const isActive = subTab === tabId;
      const subTabType = subTab.replace('acc_', '');
      
      accNavRow.push(
        Markup.button.callback(
          getTabEmoji(subTab) + (isActive ? ` [${getTabName(subTab)}]` : ''),
          isActive ? 'noop' : `station_acc:${station.id}:${subTabType}`,
          { hide: isActive }
        )
      );
    });
    
    keyboard.splice(1, 0, accNavRow);
  }
  
  return { message, keyboard };
}

function getAvailableTabs(station) {
  const baseTabs = ['main'];
  
  if (station.transferLines?.length > 0) {
    baseTabs.push('transfers');
  }
  
  if (station.surroundings || station.commerce || station.amenities) {
    baseTabs.push('surroundings');
  }
  
  if (station.accessibility) {
    baseTabs.push('accessibility');
    
    if (station.accessDetails) {
      baseTabs.push('acc_summary');
      if (station.accessDetails.elevators?.length) baseTabs.push('acc_elevators');
      if (station.accessDetails.escalators?.length) baseTabs.push('acc_escalators');
      if (station.accessDetails.accesses?.length) baseTabs.push('acc_accesses');
    }
  }
  
  return baseTabs;
}

function generateMainTabMessage(station) {
  let message = `<b>🚇 ${station.displayName}</b>\n`;
  message += `Línea: ${station.line.toUpperCase()}\n\n`;
  
  // Status
  message += `<b>📢 Estado:</b>\n`;
  message += `${station.status?.appMessage || 'Sin información'}\n\n`;
  
  // Services
  if (station.services) {
    message += `<b>📖 Servicios:</b>\n`;
    message += `${station.services.replace(/redbanc/gi, 'Redbanc')}\n\n`;
  }
  
  // Accessibility summary
  if (station.accessibility) {
    const accText = station.accessibility.split('\n').slice(0, 5).join('\n');
    message += `<b>♿ Accesibilidad:</b>\n`;
    message += `${accText}${station.accessibility.split('\n').length > 5 ? '...' : ''}\n\n`;
    message += `<i>Usa los botones de accesibilidad para más detalles</i>\n\n`;
  }
  
  // Commerce
  if (station.commerce) {
    message += `<b>🛍️ Comercio:</b>\n`;
    message += `${station.commerce}\n\n`;
  }
  
  // Amenities
  if (station.amenities) {
    message += `<b>🎭 Cultura:</b>\n`;
    message += `${station.amenities}\n\n`;
  }
  
  // Transfers
  if (station.transferLines?.length) {
    message += `<b>🔄 Conecta con:</b>\n`;
    message += `${station.transferLines.map(l => `Línea ${l.toUpperCase()}`).join(', ')}\n`;
  }
  
  return message;
}

function generateSurroundingsMessage(station) {
  let message = `<b>📍 ${station.displayName} - Alrededores</b>\n\n`;
  
  // Commune
  message += `<b>📍 Comuna:</b>\n`;
  message += `${station.commune?.replace("nunoa", "Ñuñoa") || 'No disponible'}\n\n`;
  
  // Transports
  if (station.connections?.transports?.length) {
    message += `<b>🚌 Transportes:</b>\n`;
    message += `${station.connections.transports.join('\n')}\n\n`;
  }
  
  // Bikes
  if (station.connections?.bikes?.length) {
    message += `<b>🚲 Cicleteros:</b>\n`;
    message += `${station.connections.bikes.join('\n')}\n`;
  }
  
  // Add station plan image if available
  const normalizedName = normalizeStationName(station.displayName);
  message += `\n<a href="https://www.metro.cl/el-viaje/estaciones/estaciones/${normalizedName}/plano.jpg">🔍 Ver plano de la estación</a>`;
  
  return message;
}

function generateTransfersMessage(station) {
  let message = `<b>🔄 ${station.displayName} - Combinaciones</b>\n\n`;
  
  if (station.transferLines?.length) {
    station.transferLines.forEach(line => {
      message += `🔁 Línea ${line.toUpperCase()}\n`;
      // Add transfer station info if available
      const transferStation = findTransferStation(station, line);
      if (transferStation) {
        message += `- Estación: ${transferStation.displayName}\n`;
        if (transferStation.status?.appMessage) {
          message += `- Estado: ${transferStation.status.appMessage}\n`;
        }
      }
      message += '\n';
    });
  } else {
    message += 'No hay combinaciones disponibles para esta estación.';
  }
  
  return message;
}

function generateAccessibilityMessage(station, tabId = 'acc_summary', page = 0) {
  const PAGE_SIZE = 8;
  let message = `<b>♿ ${station.displayName} - `;
  let content = [];
  let totalPages = 1;
  
  switch(tabId) {
    case 'acc_summary':
      message += 'Resumen de Accesibilidad</b>\n\n';
      content = generateAccessibilitySummary(station);
      break;
    case 'acc_elevators':
      message += 'Ascensores</b>\n\n';
      if (station.accessDetails?.elevators?.length) {
        content = station.accessDetails.elevators.map(elev => 
          `${getStatusEmoji(elev.status)} <b>${elev.id}</b>\n` +
          `<i>De ${elev.from} a ${elev.to}</i>\n` +
          `${elev.notes ? `📝 ${elev.notes}\n` : ''}` +
          `🔄 Actualizado: ${formatDate(elev.lastUpdated)}`
        );
        totalPages = Math.ceil(content.length / PAGE_SIZE);
        content = content.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      } else {
        content = ['No hay ascensores registrados'];
      }
      break;
    case 'acc_escalators':
      message += 'Escaleras Mecánicas</b>\n\n';
      if (station.accessDetails?.escalators?.length) {
        content = station.accessDetails.escalators.map(esc => 
          `${getStatusEmoji(esc.status)} <b>${esc.id}</b>\n` +
          `<i>De ${esc.from} a ${esc.to}</i>\n` +
          `${esc.notes ? `📝 ${esc.notes}\n` : ''}` +
          `🔄 Actualizado: ${formatDate(esc.lastUpdated)}`
        );
        totalPages = Math.ceil(content.length / PAGE_SIZE);
        content = content.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      } else {
        content = ['No hay escaleras mecánicas registradas'];
      }
      break;
    case 'acc_accesses':
      message += 'Accesos</b>\n\n';
      if (station.accessDetails?.accesses?.length) {
        content = station.accessDetails.accesses.map(acc => 
          `${getStatusEmoji(acc.status)} <b>${acc.name || acc.id}</b>\n` +
          `${acc.description}\n` +
          `${acc.notes ? `📝 ${acc.notes}\n` : ''}` +
          `🔄 Actualizado: ${formatDate(acc.lastUpdated)}`
        );
        totalPages = Math.ceil(content.length / PAGE_SIZE);
        content = content.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      } else {
        content = ['No hay accesos registrados'];
      }
      break;
    default:
      message += 'Accesibilidad</b>\n\n';
      content = generateAccessibilitySummary(station);
  }
  
  message += content.join('\n\n');
  
  return { message, pages: totalPages };
}

function generateAccessibilitySummary(station) {
  const summary = [];
  
  if (station.accessDetails) {
    // Elevators
    if (station.accessDetails.elevators?.length) {
      const operational = station.accessDetails.elevators.filter(e => e.status === 'operativa').length;
      summary.push(`🛗 <b>Ascensores:</b> ${operational}/${station.accessDetails.elevators.length} operativos`);
    }
    
    // Escalators
    if (station.accessDetails.escalators?.length) {
      const operational = station.accessDetails.escalators.filter(e => e.status === 'operativa').length;
      summary.push(`🪜 <b>Escaleras:</b> ${operational}/${station.accessDetails.escalators.length} operativas`);
    }
    
    // Accesses
    if (station.accessDetails.accesses?.length) {
      const open = station.accessDetails.accesses.filter(a => a.status === 'abierto').length;
      summary.push(`🚪 <b>Accesos:</b> ${open}/${station.accessDetails.accesses.length} abiertos`);
    }
    
    // Change history
    if (station.accessDetails.changelistory?.length) {
      const latestChange = station.accessDetails.changelistory
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      summary.push(
        `\n📋 <b>Último cambio:</b> ${latestChange.action}\n` +
        `👤 Por: ${latestChange.user}\n` +
        `📅 ${formatDate(latestChange.timestamp)}`
      );
    }
  } else if (station.accessibility) {
    const accLines = station.accessibility.split('\n');
    summary.push(...accLines.map(line => {
      if (line.toLowerCase().includes('ascensor')) {
        if (line.toLowerCase().includes('fuera de servicio')) {
          return `⛔ ${line}`;
        }
        return `🛗 ${line}`;
      }
      if (line.toLowerCase().includes('escalera')) {
        return `🪜 ${line}`;
      }
      if (line.toLowerCase().includes('salida')) {
        return `🚪 ${line}`;
      }
      return line;
    }));
  } else {
    summary.push('No hay información de accesibilidad disponible');
  }
  
  return summary;
}

// Helper functions
function getTabName(tabId) {
  const names = {
    main: 'Info',
    surroundings: 'Alrededores',
    transfers: 'Combinaciones',
    accessibility: 'Accesibilidad',
    acc_summary: 'Resumen',
    acc_elevators: 'Ascensores',
    acc_escalators: 'Escaleras',
    acc_accesses: 'Accesos'
  };
  return names[tabId] || tabId;
}

function getTabEmoji(tabId) {
  const emojis = {
    main: 'ℹ️',
    surroundings: '🗺️',
    transfers: '🔄',
    accessibility: '♿',
    acc_summary: '📋',
    acc_elevators: '🛗',
    acc_escalators: '🪜',
    acc_accesses: '🚪'
  };
  return emojis[tabId] || 'ℹ️';
}

function getStatusEmoji(status) {
  const statusMap = {
    'operativa': '🟢',
    'abierto': '🟢',
    'fuera de servicio': '🔴',
    'cerrado': '🔴',
    'en mantención': '🟡',
    'restringido': '🟡'
  };
  return statusMap[status?.toLowerCase()] || '⚪';
}

function formatDate(dateString) {
  if (!dateString) return 'Fecha desconocida';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CL');
}

function normalizeStationName(name) {
  let normalized = name.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*l\d+[a-z]?/i, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace("puente-cal-y-canto", "cal-y-canto");
  
  if (normalized === "plaza-armas") normalized = "plaza-de-armas";
  if (normalized === "ula") normalized = "union-latinoamericana";
  
  return normalized;
}

function findTransferStation(currentStation, line) {
  // Simplified version - in a real implementation you'd search your data source
  const baseName = currentStation.displayName.replace(/\s(L\d+[a-z]?)$/i, '').trim();
  return {
    displayName: `${baseName} ${line.toUpperCase()}`,
    status: { appMessage: 'Operativa' }
  };
}
