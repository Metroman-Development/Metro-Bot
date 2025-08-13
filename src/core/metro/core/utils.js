// modules/metro/core/utils.js

/**
 * Groups consecutive stations in the same status change
 * @param {Array} stations - Array of station change objects
 * @returns {Array} Grouped stations in desde-hasta format
 */
function groupConsecutiveStations(stations) {
  if (!stations || stations.length === 0) return [];

  // Sort stations by line order (assuming each station has lineOrder property)
  const sorted = [...stations].sort((a, b) => a.lineOrder - b.lineOrder);
  const groups = [];
  let currentGroup = [];

  sorted.forEach((station, index) => {
    if (currentGroup.length === 0) {
      currentGroup.push(station);
      return;
    }

    const prevStation = sorted[index - 1];
    const isConsecutive = station.lineOrder === prevStation.lineOrder + 1;
    const sameStatus = station.to === prevStation.to;

    if (isConsecutive && sameStatus) {
      currentGroup.push(station);
    } else {
      if (currentGroup.length >= 3) { // Only group if 3+ consecutive
        groups.push(currentGroup);
      } else {
        groups.push(...currentGroup); // Add as individuals
      }
      currentGroup = [station];
    }
  });

  // Add remaining group
  if (currentGroup.length >= 3) {
    groups.push(currentGroup);
  } else {
    groups.push(...currentGroup);
  }

  return groups.map(group => {
    if (Array.isArray(group)) {
      const first = group[0];
      const last = group[group.length - 1];
      return {
        type: 'group',
        line: first.line,
        status: first.to,
        fromStation: first.id,
        toStation: last.id,
        count: group.length
      };
    }
    return group;
  });
}

/**
 * Calculates severity level based on changes
 */
function calculateSeverity(changes) {
  const lineClosures = changes.lines.filter(l => ['2', '3'].includes(l.to)).length;
  const stationClosures = changes.stations.filter(s => ['2', '3'].includes(s.to)).length;

  if (lineClosures > 0) return 'critical';
  if (stationClosures >= 5) return 'high';
  if (stationClosures >= 3) return 'medium';
  if (changes.stations.some(s => s.to === '4')) return 'low'; // Delays
  return 'info';
}

/**
 * Normalizes status codes to consistent format
 */
function normalizeStatus(status) {
  const statusMap = {
    '1': 'operational',
    '2': 'closed',
    '3': 'partial_closure',
    '4': 'delayed',
    '5': 'extended'
  };
  return statusMap[status] || status;
}

module.exports = {
  groupConsecutiveStations,
  calculateSeverity,
  normalizeStatus
};