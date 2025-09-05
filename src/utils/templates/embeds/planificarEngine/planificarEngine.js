const { getCachedMetroData } = require('../../../../events/metroDataHandler');
const metroConfig = require('../../../../config/metro/metroConfig');
const { normalize } = require('../../../../utils/stringUtils');
const { hasExpressRoute } = require('../../../../utils/lineUtils');
const { getAllStations } = require('../../../../utils/dataUtils');

// --------------------------
// Status Messages (Object, Not a Function)
// --------------------------
const statusMessages = {
  2: { emoji: '⛔', text: 'Estación completamente cerrada' },
  3: { emoji: '🚧', text: 'Solo transferencias permitidas' },
  4: { emoji: '⚠️', text: 'Retrasos en la línea' }
};

// --------------------------
// Display Configuration
// --------------------------
const DISPLAY_LABELS = {
  takeRoute: (route) => `🎫 ¡Toma el Tren ${route}! ${getRouteEmoji(route)}`,
  takeEitherRoute: () => `🎫 ¡Toma el Tren Ruta Verde 🟢 o Ruta Roja 🔴!`,
  nextStop: (endLine, station) => `🚉 **La próxima detención es: ${station}**`,
  peakTravel: (greenEmoji, greenCount, redEmoji, redCount, endLine, station) =>
    `🚉 **Viaja ${greenEmoji} ${greenCount} ${pluralizeEstacion(greenCount)} ` +
    `o ${redEmoji} ${redCount} ${pluralizeEstacion(redCount)} hasta ${station}**`,
  regularTravel: (total, endLine, station) =>
    `🚉 **Viaja ${total} ${pluralizeEstacion(total)} hasta ${station}**`,
  transfer: (from, to, direction) => `🔀 **Combina desde ${from}**\n-> ${to} (Dirección: ${direction})`,
  unknownDirection: 'Dirección desconocida',
  unknownStation: 'Estación desconocida',
  routeBlocked: '❌ **Ruta no disponible debido a cierres**',
  directionMessage: (directionStation) => `📍 Dirección: ${directionStation}`
};

// --------------------------
// Helper Functions
// --------------------------

/**
 * Format the line name with its corresponding emoji.
 * @param {string} line - The line identifier (e.g., "l1", "l5").
 * @returns {string} The formatted line name with emoji.
 */
function formatLineName(line) {
  return `${metroConfig.linesEmojis[line] || '🚇'}`;
}

/**
 * Get the emoji for a specific route type.
 * @param {string} routeType - The route type (e.g., "Ruta Verde", "Ruta Roja").
 * @returns {string} The emoji for the route or an empty string if not found.
 */
function getRouteEmoji(routeType) {
  const normalizedType = normalize(routeType?.replace("Ruta ", "") || '');
  return metroConfig.routeStyles[normalizedType]?.emoji || '';
}

/**
 * Get the status of a station from cached data.
 * @param {string} stationName - The name of the station.
 * @returns {number} The status code (0 = normal, 2 = closed, 3 = transfer only, 4 = delays).
 */
function getStationStatus(stationName) {
  const metroData = getCachedMetroData();
  for (const line of Object.values(metroData)) {
    const station = line.estaciones.find(s => s.nombre === stationName);
    if (station) return station.estado || 0;
  }
  return 0;
}

/**
 * Get the status of a line from cached data.
 * @param {string} line - The line identifier (e.g., "l1", "l5").
 * @returns {number} The status code (0 = normal, 4 = delays).
 */
function getLineStatus(line) {
  const metroData = getCachedMetroData();
  return metroData[line]?.estado || 0;
}

/**
 * Count the number of stations between two stations, categorizing them by route type.
 * @param {string} startStationName - The name of the starting station.
 * @param {string} endStationName - The name of the ending station.
 * @param {string} farePeriod - The fare period (e.g., "PUNTA").
 * @param {string} line - The line identifier (e.g., "l1", "l5").
 * @returns {Object} An object with counts for "verde", "roja", and "total" stations.
 */
function countStationsBetween(startStationName, endStationName, farePeriod, line) {
  const allStations = getAllStations();
  if (!allStations) {
    console.error('Station data is not loaded. Call loadStationData() first.');
    return { verde: 0, roja: 0, total: 0 };
  }

  const startStation = allStations[startStationName];
  const endStation = allStations[endStationName];

  if (!startStation || !endStation) {
    console.error('Start or end station not found.');
    return { verde: 0, roja: 0, total: 0 };
  }

  const stationsArray = Object.values(allStations);
  const startIndex = stationsArray.findIndex(s => s.original === startStationName);
  const endIndex = stationsArray.findIndex(s => s.original === endStationName);

  if (startIndex === -1 || endIndex === -1) {
    console.error('Start or end station not found in the stations array.');
    return { verde: 0, roja: 0, total: 0 };
  }

  const direction = startIndex < endIndex ? 1 : -1;

  let verde = 0;
  let roja = 0;
  let total = 0;

  // Check if express routes are relevant
  const hasExpress = hasExpressRoute(line) && farePeriod === 'PUNTA';

  for (let i = startIndex + direction; i !== endIndex; i += direction) {
    const current = stationsArray[i];
    total++;

    // Only count verde/roja if express routes are relevant
    if (hasExpress) {
      if (current.route === 'Común'|| current.route=== 'Estándar' ) {
        verde++;
        roja++;
      } else if (current.route === 'Ruta Verde') {
        verde++;
      } else if (current.route === 'Ruta Roja') {
        roja++;
      }
    }
  }

  return { verde, roja, total, hasExpress };
}

/**
 * Helper function to pluralize "estación" correctly.
 * @param {number} count - The number of stations.
 * @returns {string} "estación" or "estaciones".
 */
function pluralizeEstacion(count) {
  return count === 1 ? 'estación' : 'estaciones';
}

/**
 * Calculate the direction of the trip based on the starting and ending stations.
 * @param {string} startStationName - The name of the starting station.
 * @param {string} endStationName - The name of the ending station.
 * @returns {string} The direction (name of the last station in the same direction).
 */
function calculateDirection(startStationName, endStationName) {
  const allStations = getAllStations();
  if (!allStations) return DISPLAY_LABELS.unknownDirection;

  const startStation = allStations[startStationName];
  const endStation = allStations[endStationName];

  if (!startStation || !endStation) return DISPLAY_LABELS.unknownDirection;

  const stationsArray = Object.values(allStations);
  const startIndex = stationsArray.findIndex(s => s.original === startStationName);
    const relativeEndIndex =  stationsArray.findIndex(s=>s.original === endStationName);
  const endIndex = stationsArray.length;

  if (startIndex === -1 || relativeEndIndex === -1) return DISPLAY_LABELS.unknownDirection;

  const direction = startIndex < relativeEndIndex ? 1 : -1; // 1 = forward, -1 = backward
  const line = startStation.line; // Line of the starting station

  let lastStationInDirection = startStationName;

  // Iterate through stations in the direction of travel
  for (let i = startIndex + direction;  i  < endIndex+1 && i > -1; i += direction) {


    const currentStation = stationsArray[i];


      if (!currentStation) break;
      //console.log(stationsArray[i]);

    if (currentStation.line === line || i === 0 || i === endIndex-1) {
      lastStationInDirection = currentStation.original;

    } else {
      break; // Stop if we reach a station on a different line
    }
  }

  return lastStationInDirection;
}

/**
 * Generate the display string for a tramo based on its type.
 * @param {Object} tramo - The tramo object.
 * @param {Object} counts - The station counts from countStationsBetween.
 * @param {string} farePeriod - The fare period (e.g., "PUNTA").
 * @param {Object} options - Additional options (e.g., isFirstTramo, routeTramos).
 * @returns {string} The formatted display string for the tramo.
 */
function getTramoDisplay(tramo, counts, farePeriod, options = {}) {
  const {
    isFirstTramo = false,
    isLastTramo = false,
    routeTramos = [],
    currentIndex = 0
  } = options;

  const { tipo, direccion, linea } = tramo;
  const direction = direccion || DISPLAY_LABELS.unknownDirection;

  // Helper to get station display name
  const getStationDisplay = (station) =>
    station ? `${formatLineName(station.linea)} ${station.nombre}` : DISPLAY_LABELS.unknownStation;

  // Handle station inference for combinacion/cambio
  let inicio, fin;
  if (tipo === 'combinacion' || tipo === 'cambio') {
    // Get previous and next tramos
    const prevTramo = routeTramos[currentIndex - 1];
    const nextTramo = routeTramos[currentIndex + 1];

    // Start: Last station of previous tramo or route start
    inicio = prevTramo?.fin || (isFirstTramo ? routeTramos[0]?.inicio : null);

    // End: First station of next tramo or route end
    fin = nextTramo?.inicio || (isLastTramo ? routeTramos[routeTramos.length - 1]?.fin : null);
  } else {
    // Regular tramo uses its own stations
    inicio = tramo.inicio;
    fin = tramo.fin;
  }

  const endLine = formatLineName(fin?.linea || linea);

  // Determine the conditional station
  const conditionalStation = isFirstTramo ? inicio : fin;

  // Get the route of the conditional station
  const conditionalRoute = conditionalStation?.route || 'Común';

  // Calculate direction for the first station of the full trip
  let directionMessage = '';
  if (isFirstTramo) {
    const directionStation = calculateDirection(inicio.nombre, fin.nombre);
    directionMessage = DISPLAY_LABELS.directionMessage(directionStation);
  }

  // Express route handling
  let expressMessage = '';
  if (counts.hasExpress && farePeriod === 'PUNTA' && isFirstTramo) {
    if (conditionalRoute === 'Ruta Verde') {
      expressMessage = `${DISPLAY_LABELS.takeRoute('Ruta Verde')} ${directionMessage}`;
    } else if (conditionalRoute === 'Ruta Roja') {
      expressMessage = `${DISPLAY_LABELS.takeRoute('Ruta Roja')} ${directionMessage}`;
    } else if (conditionalRoute === 'Común') {
      expressMessage = `${DISPLAY_LABELS.takeEitherRoute()} ${directionMessage}`;
    }
  } else if (isFirstTramo) {
    // Display direction even if there's no express route
    expressMessage = directionMessage;
  }

  if (tipo === 'tramo') {
    let baseMessage;
    if (counts.total === 0) {
      baseMessage = DISPLAY_LABELS.nextStop(endLine, getStationDisplay(fin));
    } else if (counts.hasExpress && farePeriod === 'PUNTA') {
      // Display logic for express routes under PUNTA fare period
      if (conditionalRoute === 'Ruta Verde') {
        baseMessage = `🚉 **Viaja ${getRouteEmoji('Verde')} ${counts.verde} ${pluralizeEstacion(counts.verde)} hasta ${getStationDisplay(fin)}**`;
      } else if (conditionalRoute === 'Ruta Roja') {
        baseMessage = `🚉 **Viaja ${getRouteEmoji('Roja')} ${counts.roja} ${pluralizeEstacion(counts.roja)} hasta ${getStationDisplay(fin)}**`;
      } else if (conditionalRoute === 'Común') {
        baseMessage = DISPLAY_LABELS.peakTravel(
          getRouteEmoji('Verde'), counts.verde,
          getRouteEmoji('Roja'), counts.roja,
          endLine, getStationDisplay(fin)
        );
      }
    } else {
      // Regular travel message
      baseMessage = DISPLAY_LABELS.regularTravel(counts.total, endLine, getStationDisplay(fin));
    }
    return expressMessage + baseMessage;
  }

  if (tipo === 'combinacion' || tipo === 'cambio') {
    const from = getStationDisplay(inicio);
    const to = getStationDisplay(fin);
    return expressMessage + DISPLAY_LABELS.transfer(from, to, direction);
  }

  return `❌ Tramo no reconocido (${tipo})`;
}

// Add to exports
module.exports = {
    countStationsBetween,
    pluralizeEstacion,
  statusMessages,
  formatLineName,
  getRouteEmoji,
  getStationStatus,
  getLineStatus,
  calculateDirection,
  DISPLAY_LABELS,
  getTramoDisplay
};
