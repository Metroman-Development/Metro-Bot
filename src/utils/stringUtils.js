const styles = require('../config/styles.json');
const stations = {};
const stationConnections = {};
// const { getCachedMetroData } = require('../events/metroDataHandler');


// ===== CORE UTILITY FUNCTIONS ===== //
function normalize(text) {
  if (typeof text !== 'string') return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanLineKey(lineCode) {
  if (!lineCode) return 'l1';
  const match = lineCode.toString().match(/l?(\d+[a-z]*)/i);
  const baseNum = match ? match[1].toLowerCase() : '1';
  const validLines = ['1', '2', '3', '4', '4a', '5', '6'];
  return `l${validLines.includes(baseNum) ? baseNum : '1'}`;
}

function sanitizeInput(input) {
  if (!input) return '';
  return input
    .slice(0, 50)
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-]/g, '')
    .replace(/(\bL+)(\d+)/gi, (_, l, num) => `L${num}`)
    .trim();
}

function formatStationName(stationName) {
  if (!stationName) return '';
  return stationName
    .replace(/estación/gi, '')
    .split(/[\s\-]+/)
    .map(word =>
      /^(d?[aeiou]|las?|los|el|del|al|y)$/i.test(word)
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join(' ');
}

function formatLineCode(lineCode) {
  const cleaned = cleanLineKey(lineCode);
  const lineNumber = cleaned.replace(/l/i, '');
  const validLines = ['1', '2', '3', '4', '4a', '5', '6'];
  const safeNumber = validLines.includes(lineNumber) ? lineNumber : '1';
  return `Línea ${safeNumber.toUpperCase()}`;
}

function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function removeLineSuffix(stationName) {
  if (!stationName) return '';

    return stationName.replace(/\s+L\d+[a-z]*$/i, '');
}

function extractLineNumber(input) {
  const match = input.match(/l(\d+[a-z]*)/i);
  return match ? match[1].toLowerCase() : '1';
}

function generateStationId(stationName, lineCode) {
  return `${normalize(stationName)}-l${extractLineNumber(lineCode)}`;
}

function isMetroRelated(text) {
  const keywords = ['metro', 'estación', 'línea', 'tren', 'andén', 'combinación'];
  return keywords.some(keyword => normalize(text).includes(normalize(keyword)));
}

function processLineText(input, options = {}) {
  if (!input) return defaultReturn(options);

  // Define valid lines (case-insensitive)
  const validLines = ["l1", "l2", "l3", "l4", "l4a", "l5", "l6"];

  const linePattern = /(?:l[íi]nea?\s*)?(l?\s*(\d+[a-z]*))|(\d+[a-z]*)/i;
  const match = input.match(linePattern);
  const baseNum = match ? (match[2] || match[3] || '1').toLowerCase() : null;

  // If no match and not strict mode, default to '1' (if allowed)
  if (!match && !options.strict) {
    return validLines.includes('l1') ? (options.normalize ? 'l1' : 'L1') : null;
  }

  // If no match (and strict mode), return null
  if (!match) return null;

  // Construct the normalized line (e.g., 'l6')
  const normalizedLine = `l${baseNum}`;

  // Check if the normalized line is in the validLines array
  const isValidLine = validLines.includes(normalizedLine.toLowerCase());

  // If strict mode is enabled and the line is invalid, return null
  if (options.strict && !isValidLine) return null;

  // If extract mode, return the converted format (if valid)
  if (options.extract) {
    return isValidLine ? convertFormat(baseNum, options) : null;
  }

  // If normalize mode, return the normalized line (if valid)
  if (options.normalize) {
    return isValidLine ? normalizedLine : null;
  }

  // If 'to' option is specified, return the converted format (if valid)
  if (options.to) {
    return isValidLine ? convertFormat(baseNum, options) : null;
  }

  // Default: return uppercase (if valid)
  return isValidLine ? `L${baseNum.toUpperCase()}` : null;
}

// ===== STATION DECORATION FUNCTIONS ===== //

function getStationConnections(lineKey, stationName, metroInfoProvider) {
  const metroConfig = metroInfoProvider.getConfig();
  const normalizedLine = cleanLineKey(lineKey);
  const exactMatch = stationConnections[normalizedLine]?.estaciones?.find(s =>
    s.nombre === stationName
  );
  if (exactMatch) return exactMatch;

  const normalizedSearch = normalize(stationName);
  return stationConnections[normalizedLine]?.estaciones?.find(s =>
    normalize(s.nombre) === normalizedSearch
  ) || { conexiones: [], bici: [] };
}

function getConnectionEmojis(connections, metroInfoProvider) {
  const metroConfig = metroInfoProvider.getConfig();
  return [
    ...(connections.conexiones || []).map(c => metroConfig.connectionEmojis[c]),
    ...(connections.bici || []).map(b => metroConfig.connectionEmojis[b])
  ].filter(e => e).join(' ');
}
function getStatusEmoji(statusCode, metroInfoProvider) {
  const metroConfig = metroInfoProvider.getConfig();
  // Convert statusCode to a string (since some keys are numbers in statusTypes)
  const statusKey = String(statusCode);

  // Check if the status exists in statusTypes
  if (metroConfig.statusTypes[statusKey]) {
    return metroConfig.statusTypes[statusKey].emoji;
  }

  // Fallback to 🔵 if status is unknown
  return '🔵';
}

// Debug mode
const DEBUG = false;

const logDebug = (...args) => {
  if (DEBUG) console.log('[DEBUG stringUtils]', ...args);
};

function getRouteEmoji(lineKey, stationName, metroInfoProvider) {
  const metroConfig = metroInfoProvider.getConfig();
  const cleanName = stationName;
  const routeType = stations[lineKey.toLowerCase()]?.[cleanName]?.ruta?.toLowerCase().replace(/\s+/g, '').replace("ruta", "").replace("ú","u") ;

    const emoji = metroConfig.routeStyles[routeType]?.emoji || '';

  logDebug('Route emoji for', {
    station: stationName,
    line: lineKey,
    cleanName,
    routeType,
    emoji
  });

  return emoji;
}

async function getTransferLines(stationName, lineKey, metroInfoProvider) {
  const metroConfig = metroInfoProvider.getConfig();
  if (!stationName || !lineKey) return '';

  try {
    const { stations } = await metroInfoProvider.getFullData();
    if (!stations) return '';

    const station = stations[lineKey]?.[stationName];
    if (!station || !station.transfer) return '';

    const transferLines = station.transfer
      .map(line => metroConfig.linesEmojis[line.toLowerCase()])
      .filter(Boolean)
      .join(' ');

    return transferLines ? ` ${transferLines}` : '';
  } catch (error) {
    console.error(`Error getting transfer lines for ${stationName}:`, error);
    return '';
  }
}



// Update decorateStation function
async function decorateStation(stationName, options = {}, metroInfoProvider) {
  try {
    const { line, status, ruta, transfer, conexiones } = options;

    const statusEmoji = getStatusEmoji(status, metroInfoProvider);
    const routeEmoji = ruta ? getRouteEmoji(line, stationName, metroInfoProvider) : '';
    const transferInfo = transfer ? await getTransferLines(stationName, line, metroInfoProvider) : '';
    const connectionEmojis = conexiones ? getConnectionEmojiList(stationName, line, metroInfoProvider) : '';

    const parts = [statusEmoji, routeEmoji, removeLineSuffix(stationName), transferInfo, connectionEmojis];

    return parts.filter(Boolean).join(' ');
  } catch (error) {
    console.error(`Error decorating station ${stationName}:`, error);
    return stationName; // Fallback to just the station name
  }
}

// Modified isTransferStation to be more accurate
function isTransferStation(stationName, lineKey) {

    console.log(lineKey) ;
  if (!stationName) return false;

  // Check if station has transfer in data
  const hasTransfer = stations[lineKey]?.[stationName]?.transfer ||
                        stations[lineKey]?.[stationName]?.transfer;

  // Check if name ends with line suffix
  const hasSuffix = / L\d+[a-zA-Z]*$/i.test(stationName);

  logDebug('Transfer station check:', {
    stationName,
    lineKey,
    hasTransfer,
    hasSuffix
  });

  return hasTransfer || hasSuffix;
}

function addConnectionSuffix(stationName, lineKey, metroInfoProvider) {
  const emojis = getConnectionEmojis(getStationConnections(lineKey, stationName, metroInfoProvider), metroInfoProvider);
  return emojis ? `${stationName} ${emojis}` : stationName;
}

// ===== EMBED/UI FUNCTIONS ===== //
function formatEmbedTimestamp(date = new Date()) {
  return date.toLocaleString('es-CL', { timeZone: 'America/Santiago' });
}

function getLineEmoji(lineKey, metroInfoProvider) {
  const metroConfig = metroInfoProvider.getConfig();
  return metroConfig.linesEmojis[lineKey.toLowerCase()] || '';
}

function formatLineString(input, options = {}, metroInfoProvider) {
  if (typeof input !== 'string') return '';

  // Helper function to extract line info
  const extractLineInfo = (str) => {
    const match = str.match(/(?:l[íi]nea?\s*)?(l?\s*(\d+[a-z]*))|(\d+[a-z]*)/i);
    return match ? (match[2] || match[3] || '1').toLowerCase() : '1';
  };

  const baseNum = extractLineInfo(input);
  const lineKey = `l${baseNum}`;
  const emoji = getLineEmoji(lineKey, metroInfoProvider) || '🚇'; // Fallback to generic metro emoji

  if (options.emojiReplace) {
    // Return just the emoji
    return emoji;
  }

  if (options.suffixEmoji) {
    // Format as "Línea <emoji>"
    return `Línea ${emoji}`;
  }

  // Handle other formatting options
  if (options.removeL) return baseNum;
  if (options.abbrevLow) return `l${baseNum}`;
  if (options.abbrevUp) return `L${baseNum.toUpperCase()}`;
  if (options.unAbbrev) return `Línea ${baseNum.toUpperCase()}`;

  // Default format (L5)
  return `L${baseNum.toUpperCase()}`;
}

// ===== PRIVATE HELPERS ===== //
function convertFormat(baseNum, options) {
  const suffix = baseNum.toLowerCase();
  switch (options.to) {
    case 'code': return `L${suffix.toUpperCase()}`;
    case 'lower': return `l${suffix}`;
    case 'full': return `Línea ${suffix.toUpperCase()}`;
    case 'number': return suffix;
    default: return `L${suffix.toUpperCase()}`;
  }
}

function defaultReturn(options) {
  const baseNum = '1';
  if (options.to === 'number') return baseNum;
  if (options.to === 'lower') return `l${baseNum}`;
  if (options.to === 'full') return `Línea ${baseNum}`;
  return `L${baseNum}`;
}

// Add to stringUtils.js
// In stringUtils.js - Final getConnectionEmojiList function
// In stringUtils.js - Simplified connection emoji function
function getConnectionEmojiList(stationName, lineKey, metroInfoProvider) {
  try {
    const metroConfig = metroInfoProvider.getConfig();
    const connections = getStationConnections(lineKey, stationName, metroInfoProvider);
    const emojis = new Set();

    // 1. Process all connections (including EIM)
    if (connections.conexiones) {
      connections.conexiones.forEach(conn => {
        const emoji = metroConfig.connectionEmojis[conn];
        if (emoji) emojis.add(emoji);
      });
    }

    // 2. Add bike connections
    if (connections.bici) {
      connections.bici.forEach(bike => {
        const emoji = metroConfig.connectionEmojis[bike];
        if (emoji) emojis.add(emoji);
      });
    }

    return emojis.size > 0
      ? Array.from(emojis).join(' ')
      : ''; // Cross mark for no connections

  } catch (error) {
    console.error('Error getting connection emojis:', error);
    return '';
  }
}

/**
 * Gets a pure emoji string of all connections for a station
 * @param {string} stationName - The station name
 * @param {string} lineKey - The line key (e.g., 'l1')
 * @returns {string} Emoji string of connections
 */
module.exports = {
  // Core utilities
  normalize,
  cleanLineKey,
  sanitizeInput,
  formatStationName,
  formatLineCode,
  capitalizeFirstLetter,
  cleanStationName: (name) => formatStationName(name).replace(/[^\w\s]/gi, ''),
  compareNormalized: (a, b) => normalize(a) === normalize(b),
  removeLineSuffix,
  extractLineNumber,
  generateStationId,
  processLineText,
  isMetroRelated,

  // Station decoration
  getStationConnections,
  getConnectionEmojis,
  getStatusEmoji,
  decorateStation,
  addConnectionSuffix,
  isTransferStation,

  // Embed/UI functions
  formatEmbedTimestamp,
  getLineEmoji,
  formatLineString,
  getConnectionEmojiList,

  // Legacy functions
  decorateStationName: (name, line, route, metroInfoProvider) => {
    const metroConfig = metroInfoProvider.getConfig();
    let decorated = name;
    if (line) {
      const emoji = getLineEmoji(line, metroInfoProvider);
      if (emoji) decorated = `${emoji} ${decorated}`;
    }
    if (route) {
      const routeKey = route.toLowerCase().replace(/\s+/g, '');
      const emoji = metroConfig.routeStyles[routeKey]?.emoji;
      if (emoji) decorated = `${emoji} ${decorated}`;
    }
    return decorated;
  }
};