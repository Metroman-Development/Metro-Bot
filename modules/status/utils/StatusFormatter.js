const StatusConfig = require('../config/statusConfig');
const logger = require('../../../events/logger');

class StatusFormatter {
  static normalize(rawData) {
    try {
      return {
        timestamp: new Date(),
        lines: rawData.lines.map(line => ({
          id: line.id.toLowerCase(),
          number: line.lineNumber,
          status: this._mapStatus(line.statusCode),
          statusDetails: this._getStatusDetails(line.statusCode),
          stations: line.stations?.map(s => ({
            id: s.id.toLowerCase(),
            name: s.name,
            status: this._mapStatus(s.statusCode),
            statusDetails: this._getStatusDetails(s.statusCode)
          })) || []
        }))
      };
    } catch (error) {
      logger.error('STATUS_NORMALIZATION_FAILED', error);
      throw new Error('Failed to normalize status data');
    }
  }

  static formatLine(lineData) {
    try {
      const statusInfo = StatusConfig.LINE_STATUSES[lineData.status] || StatusConfig.LINE_STATUSES.unknown;
      return {
        ...lineData,
        emoji: statusInfo.emoji,
        color: statusInfo.color,
        statusText: `${statusInfo.emoji} ${statusInfo.displayText}`,
        stations: lineData.stations?.map(s => {
          const stationStatus = StatusConfig.STATION_STATUSES[s.status] || StatusConfig.STATION_STATUSES.unknown;
          return {
            ...s,
            displayText: `${stationStatus.emoji} ${s.name}`
          };
        })
      };
    } catch (error) {
      logger.error('LINE_FORMAT_FAILED', error);
      throw new Error('Failed to format line data');
    }
  }

  static _mapStatus(metroStatusCode) {
    return StatusConfig.METRO_STATUS_MAP[metroStatusCode] || 'unknown';
  }

  static _getStatusDetails(status) {
    return StatusConfig.STATUS_DETAILS[status] || {
      description: 'Status unknown',
      priority: 0
    };
  }
}

module.exports = StatusFormatter;