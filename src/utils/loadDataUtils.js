const stringSimilarity = require('string-similarity');

/**
 * Flattens the static station data from stations.json into a more easily searchable format.
 * @param {object} staticStationsData - The raw data from stations.json.
 * @returns {Array<object>} A flat array of station objects.
 */
function flattenStaticStations(staticStationsData) {
  const flatStations = [];
  for (const lineId in staticStationsData) {
    for (const stationName in staticStationsData[lineId]) {
      const stationData = staticStationsData[lineId][stationName];
      flatStations.push({
        name: stationName,
        line: lineId,
        aliases: stationData.aliases || [],
      });
    }
  }
  return flatStations;
}

/**
 * Cleans a station name by removing line identifiers like "L1", "L2", etc.
 * @param {string} stationName - The name of the station.
 * @returns {string} The cleaned station name.
 */
function cleanStationName(stationName) {
  let cleanedName = stationName.replace(/ L\d[A-Z]?$/, '');
  if (cleanedName.startsWith('Pdte.')) {
    cleanedName = cleanedName.replace('Pdte.', '').trim();
  }
  return cleanedName;
}

/**
 * Finds a matching station from the static data based on the source station's information.
 * @param {object} sourceStation - The station object from estadoRed.json ({ nombre, codigo }).
 * @param {string} lineId - The line ID of the source station.
 * @param {Array<object>} allStaticStations - A flattened array of all static stations.
 * @returns {object|null} The matched static station object or null if no match is found.
 */
function findMatchingStation(sourceStation, lineId, allStaticStations) {
  const { nombre, codigo } = sourceStation;
  const cleanedSourceName = cleanStationName(nombre);
  const normalizedSourceName = cleanedSourceName.toLowerCase();

  // 1. Exact match (case-insensitive)
  let potentialMatches = allStaticStations.filter(
    (s) =>
      cleanStationName(s.name).toLowerCase() === normalizedSourceName ||
      s.aliases.some((alias) => alias.toLowerCase() === normalizedSourceName)
  );

  if (potentialMatches.length > 0) {
    if (potentialMatches.length > 1) {
      // Disambiguate
      const sameLineMatch = potentialMatches.find((s) => s.line === lineId);
      if (sameLineMatch) {
        return sameLineMatch;
      }
    }
    return potentialMatches[0];
  }

  // 2. Short name logic (code match)
  if (
    (nombre.length >= 2 && nombre.length <= 3) &&
    !['U.L.A.', 'ULA'].includes(nombre.toUpperCase())
  ) {
    const matchedByCode = allStaticStations.find(
      (staticStation) =>
        staticStation.name.toLowerCase() === codigo.toLowerCase() ||
        staticStation.aliases.some(
          (alias) => alias.toLowerCase() === codigo.toLowerCase()
        )
    );
    if (matchedByCode) {
      return matchedByCode;
    }
  }

  // 3. Fallback to string similarity
  const allNames = allStaticStations.flatMap((s) => [
    s.name,
    ...s.aliases,
  ]);

  const bestMatch = stringSimilarity.findBestMatch(
    normalizedSourceName,
    allNames
  );

  if (bestMatch.bestMatch.rating >= 0.75) {
    const matchedName = bestMatch.bestMatch.target;
    potentialMatches = allStaticStations.filter(
      (s) =>
        s.name.toLowerCase() === matchedName.toLowerCase() ||
        s.aliases.some((alias) => alias.toLowerCase() === matchedName.toLowerCase())
    );

    if (potentialMatches.length > 1) {
      const sameLineMatch = potentialMatches.find((s) => s.line === lineId);
      if (sameLineMatch) {
        return sameLineMatch;
      }
    }
    return potentialMatches[0];
  }

  return null;
}

module.exports = {
  findMatchingStation,
  flattenStaticStations,
};
