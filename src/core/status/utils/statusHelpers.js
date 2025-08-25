const logger = require('../../../events/logger');
const { statusMap } = require('../../../config/metro/statusConfig');

// Status code to human-readable mapping
const STATUS_MAP = Object.fromEntries(
  Object.entries(statusMap).map(([code, { es }]) => [code, es])
);
STATUS_MAP.unknown = 'Status Unknown';

// Status to severity level mapping
const SEVERITY_LEVELS = {
  operational: 'low',
  delayed: 'medium',
  partial_outage: 'high',
  major_outage: 'critical',
  extended_service: 'medium',
  outage: 'critical',
  unknown: 'low',
  open: 'low',
  transfer: 'low',
  'controlled_access': 'medium',
  'partial_access': 'medium',
  closed: 'high',
  containment: 'high',
  'extended_service_(entry_only)': 'medium',
  'extended_service_(exit_only)': 'medium',
  slow: 'medium',
  delays: 'high',
  partial: 'high',
  suspended: 'critical',
  'off-service': 'low',
  'with_delays': 'high',
  'partial_service': 'high',
};

// Status code to normalized form mapping
const CODE_NORMALIZATION = Object.fromEntries(
  Object.entries(statusMap).map(([code, { en }]) => [
    code,
    en.replace(/-/g, '_'),
  ])
);

/**

 * Normalizes status codes to consistent status strings

 * @param {string|number} code - Raw status code from API

 * @returns {string} Normalized status

 */

function normalizeStatus(code) {

  if (code === undefined || code === null) {

    logger.warn('Received empty status code, defaulting to unknown');

    return 'unknown';

  }

  

  // Convert to string if it's a number

  const codeStr = code.toString();

  const normalized = CODE_NORMALIZATION[codeStr];

  

  if (!normalized) {

    logger.error(`Unknown status code: ${codeStr}`);

    return 'unknown';

  }

  

  return normalized;

}

/**

 * Calculates system-wide severity based on statuses

 * @param {Object} data - Processed status data

 * @returns {string} Highest severity level

 */

function calculateSeverity(data = {}) {

  try {

    const allStatuses = [

      ...Object.values(data.lines || {}).map(l => l.normalizedStatus),

      ...Object.values(data.stations || {}).map(s => s.normalizedStatus)

    ];

    const severityOrder = ['critical', 'high', 'medium', 'low'];

    let maxSeverity = 'low';

    allStatuses.forEach(status => {

      const currentSeverity = SEVERITY_LEVELS[status] || 'low';

      if (severityOrder.indexOf(currentSeverity) < severityOrder.indexOf(maxSeverity)) {

        maxSeverity = currentSeverity;

      }

    });

    return maxSeverity;

  } catch (error) {

    logger.error('Severity calculation failed:', error);

    return 'low';

  }

}

/**

 * Groups consecutive stations with the same status

 * @param {Array} stations - Array of station changes

 * @returns {Array} Grouped stations

 */

function groupConsecutiveStations(stations = []) {

  if (!Array.isArray(stations)) return [];

  if (stations.length === 0) return [];

  

  const groups = [];

  let currentGroup = [stations[0]];

  for (let i = 1; i < stations.length; i++) {

    const prev = stations[i - 1];

    const current = stations[i];

    // Group if same line, same status, and consecutive IDs

    if (current.line === prev.line && 

        current.normalizedTo === prev.normalizedTo && 

        current.id === prev.id + 1) {

      currentGroup.push(current);

    } else {

      if (currentGroup.length > 0) {

        groups.push(currentGroup);

      }

      currentGroup = [current];

    }

  }

  

  // Add the last group

  if (currentGroup.length > 0) {

    groups.push(currentGroup);

  }

  

  return groups;

}

/**

 * Gets the status message for a given status code

 * @param {string|number} code - Status code

 * @returns {string} Human-readable status message

 */

function getStatusMessage(code) {

  const codeStr = code?.toString();

  return STATUS_MAP[codeStr] || STATUS_MAP.unknown;

}

/**

 * Gets the severity level for a given status code

 * @param {string|number} code - Status code

 * @returns {string} Severity level

 */

function getSeverityLevel(code) {

  const normalized = normalizeStatus(code);

  return SEVERITY_LEVELS[normalized] || 'low';

}

module.exports = {

  STATUS_MAP,

  SEVERITY_LEVELS,

  CODE_NORMALIZATION,

  normalizeStatus,

  calculateSeverity,

  groupConsecutiveStations,

  getStatusMessage,

  getSeverityLevel

};