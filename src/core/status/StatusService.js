// modules/status/StatusService.js
// modules/status/StatusService.js
const EventEmitter = require('events');
const logger = require('../../events/logger');
const { normalizeStatus, STATUS_MAP, SEVERITY_LEVELS } = require('./utils/statusHelpers');

class StatusService extends EventEmitter {
  constructor(metroCore) {
    super();
    this.metro = metroCore;
    this.state = {
      lines: {},
      stations: {},
      network: {
        code: '1',
        status: 'operational',
        message: 'System operational',
        appMessage: 'All lines running normally',
        severity: 'low'
      },
      lastUpdated: null,
      forcedStatuses: new Map(),
      changeHistory: []
    };

    this._setupEventHandlers();
    logger.debug('[StatusService] Initialized with MetroCore instance');
  }

  _setupEventHandlers() {
    this.metro.on('lineStatusChanged', ({ lineId, status, isForced }) => {
      this._handleLineChange(lineId, status, isForced);
    });

    this.metro.on('stationStatusChanged', ({ stationId, status }) => {
      this._handleStationChange(stationId, status);
    });

    logger.debug('[StatusService] Event handlers registered');
  }

  _handleLineChange(lineId, status, isForced = false) {
    const normalizedStatus = normalizeStatus(status.code || status);
    const previousStatus = this.state.lines[lineId]?.status;

    // Skip if no meaningful change
    if (previousStatus?.code === (status.code || status)) {
      logger.debug(`[StatusService] Line ${lineId} status unchanged (${status.code || status})`);
      return;
    }

    // Build status object
    const newStatus = {
      code: status.code || status,
      status: normalizedStatus,
      message: status.message || STATUS_MAP[status.code || status] || '',
      appMessage: status.appMessage || STATUS_MAP[status.code || status] || '',
      severity: SEVERITY_LEVELS[normalizedStatus] || 'low',
      lastUpdated: new Date()
    };

    // Update state
    this.state.lines[lineId] = {
      ...this.state.lines[lineId],
      status: newStatus
    };

    // Handle forced status
    if (isForced) {
      this.state.forcedStatuses.set(lineId, newStatus);
      logger.debug(`[StatusService] Force-set line ${lineId} to ${newStatus.code}`);
    } else {
      this.state.forcedStatuses.delete(lineId);
    }

    this._updateNetworkStatus();
    this._logChange('line', lineId, previousStatus, newStatus);
  }

  _handleStationChange(stationId, status) {
    const normalizedStatus = normalizeStatus(status.code || status);
    const previousStatus = this.state.stations[stationId]?.status;

    if (previousStatus?.code === (status.code || status)) {
      logger.debug(`[StatusService] Station ${stationId} status unchanged (${status.code || status})`);
      return;
    }

    const newStatus = {
      code: status.code || status,
      status: normalizedStatus,
      message: status.message || STATUS_MAP[status.code || status] || '',
      appMessage: status.appMessage || STATUS_MAP[status.code || status] || '',
      lastUpdated: new Date()
    };

    this.state.stations[stationId] = {
      ...this.state.stations[stationId],
      status: newStatus
    };

    this._logChange('station', stationId, previousStatus, newStatus);
  }

  _updateNetworkStatus() {
    const statusCounts = {
      '1': 0, // operational
      '2': 0, // delayed
      '3': 0, // partial_outage
      '4': 0  // major_outage
    };

    // Count line statuses
    Object.values(this.state.lines).forEach(line => {
      statusCounts[line.status.code] = (statusCounts[line.status.code] || 0) + 1;
    });

    // Determine new network status
    let newNetworkStatus;
    if (statusCounts['4'] > 0) {
      newNetworkStatus = this._createNetworkStatus('4', 'major_outage', 'critical');
    } else if (statusCounts['3'] > 0) {
      newNetworkStatus = this._createNetworkStatus('3', 'partial_outage', 'high');
    } else if (statusCounts['2'] > 0) {
      newNetworkStatus = this._createNetworkStatus('2', 'delayed', 'medium');
    } else {
      newNetworkStatus = this._createNetworkStatus('1', 'operational', 'low');
    }

    // Only emit if changed
    if (this.state.network.code !== newNetworkStatus.code) {
      const previousStatus = this.state.network;
      this.state.network = newNetworkStatus;
      this.state.lastUpdated = new Date();

      logger.info(`[StatusService] Network status changed from ${previousStatus.code} to ${newNetworkStatus.code}`);
      this.emit('networkStatusUpdated', {
        previous: previousStatus,
        current: newNetworkStatus,
        statusCounts,
        timestamp: new Date()
      });
    }
  }

  _createNetworkStatus(code, status, severity) {
    const messages = {
      '1': { message: 'System operational', appMessage: 'All lines running normally' },
      '2': { message: 'Delays reported', appMessage: 'Expect delays on some lines' },
      '3': { message: 'Partial outage', appMessage: 'Some lines not operating' },
      '4': { message: 'Major outage', appMessage: 'Severe service disruptions' }
    };

    return {
      code,
      status,
      severity,
      ...messages[code],
      lastUpdated: new Date()
    };
  }

  _logChange(type, id, previousStatus, newStatus) {
    const changeRecord = {
      type,
      id,
      from: previousStatus,
      to: newStatus,
      timestamp: new Date()
    };

    this.state.changeHistory.push(changeRecord);
    logger.info(`[StatusService] ${type} ${id} changed: ${previousStatus?.code || 'none'} → ${newStatus.code}`);

    if (this.metro._subsystems.dbService) {
      this.metro._subsystems.dbService.logStatusChange(changeRecord).catch(error => {
        logger.error('[StatusService] Failed to log status change to database:', error);
      });
    }

    if (type === 'line') {
      this.emit('lineStatusUpdated', changeRecord);
    } else {
      this.emit('stationStatusUpdated', changeRecord);
    }
  }

  handleChanges(changes) {
    if (!changes) {
      logger.warn('[StatusService] Received empty changes object');
      return;
    }

    logger.debug('[StatusService] Processing changes:', {
      lines: changes.lines?.length,
      stations: changes.stations?.length
    });

    // Process line changes
    if (changes.lines?.length > 0) {
      changes.lines.forEach(({ id, to }) => {
        this._handleLineChange(id, to);
      });
    }

    // Process station changes
    if (changes.stations?.length > 0) {
      changes.stations.forEach(({ id, to }) => {
        this._handleStationChange(id, to);
      });
    }

    // Emit consolidated update
    this.emit('statusUpdated', {
      state: this.getCurrentState(),
      changes,
      timestamp: new Date()
    });
  }

  getCurrentState() {
    return {
      network: this.state.network,
      lines: this.state.lines,
      stations: this.state.stations,
      lastUpdated: this.state.lastUpdated,
      forcedStatuses: Array.from(this.state.forcedStatuses.entries()),
      version: this.metro.config?.dataVersion || '1.0.0'
    };
  }

    // Add this method to your StatusService class

getLineStatus(lineId) {

    const line = this.state.lines[lineId];

    if (!line) {

        return {

            exists: false,

            status: {

                code: 'unknown',

                message: 'Line not found',

                appMessage: 'This line does not exist in the system'

            }

        };

    }

    return {

        exists: true,

        id: lineId,

        name: `Line ${lineId.toUpperCase()}`,

        status: line.status,

        stations: Object.values(this.state.stations)

            .filter(s => s.line === lineId)

            .map(s => ({

                id: s.id,

                name: s.name,

                status: s.status

            })),

        lastUpdated: line.status.lastUpdated

    };

} 
  
  getStationStatus(stationId) {
    return this.state.stations[stationId]?.status || {
      code: 'unknown',
      status: 'unknown',
      message: 'Status unavailable',
      appMessage: 'Status information not available'
    };
  }

  getNetworkStatus() {
    return {
      ...this.state.network,
      lineStatusCounts: this._getStatusCounts(this.state.lines),
      stationStatusCounts: this._getStatusCounts(this.state.stations)
    };
  }

  _getStatusCounts(statusMap) {
    return Object.values(statusMap).reduce((acc, { status }) => {
      acc[status.code] = (acc[status.code] || 0) + 1;
      return acc;
    }, { '1': 0, '2': 0, '3': 0, '4': 0, unknown: 0 });
  }

  forceLineStatus(lineId, status) {
    if (!this.state.lines[lineId]) {
      throw new Error(`Line ${lineId} not found`);
    }
    this._handleLineChange(lineId, status, true);
  }

  clearForcedStatus(lineId) {
    if (this.state.forcedStatuses.has(lineId)) {
      this.state.forcedStatuses.delete(lineId);
      logger.info(`[StatusService] Cleared forced status for line ${lineId}`);
      
      // Revert to current API status
      const currentApiStatus = this.metro._detailsData?.lines[lineId]?.status;
      if (currentApiStatus) {
        this._handleLineChange(lineId, currentApiStatus);
      }
    }
  }

  getChangeHistory(limit = 10) {
    return this.state.changeHistory.slice(-limit);
  }

  purgeChangeHistory() {
    this.state.changeHistory = [];
    logger.debug('[StatusService] Cleared change history');
  }

  async setSystemToOutOfService() {
    logger.info('[StatusService] Setting system to out of service due to non-operating hours.');
    const data = this.metro._subsystems.metroInfoProvider.getFullData();

    for (const lineId in data.lines) {
      this._handleLineChange(lineId, { code: 15 });
    }

    for (const stationId in data.stations) {
      this._handleStationChange(stationId, { code: 15 });
    }
  }
}

module.exports = StatusService;