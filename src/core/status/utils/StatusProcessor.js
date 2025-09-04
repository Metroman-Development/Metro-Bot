const { normalizeStatus } = require('./statusHelpers');
const logger = require('../../../events/logger');
const styles = require('../../../config/styles.json');
const TimeHelpers = require('../../../utils/timeHelpers');
const stationGrouper = require('../../../templates/utils/stationGrouper');
const statusConfig = require('../../../config/metro/metroConfig');
const DatabaseManager = require('../../database/DatabaseManager');

const DatabaseService = require('../../database/DatabaseService');

class StatusProcessor {
  constructor(dbManager, dbService) {
    this.db = dbManager;
    this.dbService = dbService;
    this.timeHelpers = TimeHelpers;
    this.lineWeights = statusConfig.lineWeights;
    this.statusMap = statusConfig.statusTypes;
    this.severityLabels = statusConfig.severityLabels;
  }

  async processRawAPIData(rawData, user = 'system') {
    

    //logger.info("STARTING STATUS PROCESSOR DATA PROCESSING WITH DATA; ", rawData);
    
    try {
      if (!rawData || typeof rawData !== 'object') {
        throw new Error('Invalid rawData received');
      }

      const dataToProcess = rawData.lineas || rawData;
      const version = this._generateVersion();
      const timestamp = this.timeHelpers.currentTime;

      // Process network status
      const networkStatusDetails = this._transformNetworkStatus(dataToProcess);
      const network = {
          status: this._mapNetworkStatus(networkStatusDetails.status),
          timestamp: networkStatusDetails.timestamp
      };

      // Process lines and stations
      const lines = {};
      const stations = {};

      Object.entries(dataToProcess).forEach(([lineId, lineData]) => {
        if (!lineId.startsWith('l')) return;

        // Process line
        lines[lineId] = this._transformLine(lineId, lineData);

        // Process stations
        (lineData.stations || []).forEach(station => {
          const stationId = station.code.toUpperCase();
          stations[stationId] = this._transformStation(station, lineId);
        });
      });

      const currentData = {
        network,
        lines,
        stations,
        version,
        lastUpdated: timestamp.toISOString(),
        isFallback: false
      };

      //console.log(stations)

      return currentData;
    } catch (error) {
      logger.error('[StatusProcessor] Processing failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }


  _transformNetworkStatus(rawData) {
    let totalSeverity = 0;
    const severityDetails = {
      lines: {},
      stations: [],
      transfers: []
    };
    const affectedSegments = {};
    const lineStatuses = {};
    const allStations = {};

    // First pass: collect line statuses and basic severity
    Object.entries(rawData).forEach(([lineId, lineData]) => {
      if (!lineId.startsWith('l')) return;
      if (!lineData.estado) {
        logger.warn(`[StatusProcessor] Missing 'estado' property for lineId: ${lineId}`);
        return;
      }
      const statusCode = lineData.estado.toString();
      lineStatuses[lineId] = statusCode;
      
      const lineSeverity = this._calculateLineSeverity(lineId, statusCode);
      if (lineSeverity > 0) {
        const statusInfo = this._getStatusInfo(statusCode, 'line', lineId);
        severityDetails.lines[lineId] = {
          name: `Línea ${lineId.slice(1)}`,
          status: statusInfo.es,
          statusEn: statusInfo.en,
          severity: lineSeverity,
          connectedTransfers: [],
          code: statusCode // Track raw status code
        };
        totalSeverity += lineSeverity;
      }

      // Process stations with proper transfer detection
      (lineData.stations || []).forEach(station => {
        if (station.status == null) {
          logger.warn(`[StatusProcessor] Missing 'status' property for station ${station.code} in line ${lineId}`);
          return;
        }
        const stationId = station.code.toLowerCase();
        const stationStatusCode = station.status.toString();
        const transformedStation = this._transformStation(station, lineId);
        allStations[stationId] = transformedStation;
        const stationSeverity = this._calculateStationSeverity(station, lineId);

        if (stationSeverity > 0) {
          let connectedLines = [];
          const hasTransfer = station.transfer && station.transfer.trim().length > 0;
          
          // Only consider actual transfer stations (must have connections to other lines)
          if (hasTransfer) {
            connectedLines = station.transfer.toLowerCase()
              .split(',')
              .map(line => line.trim())
              .filter(line => line.length > 0 && line !== lineId);
          }

          const statusInfo = this._getStatusInfo(stationStatusCode, 'station', station.code);
          const stationEntry = {
            code: stationId,
            name: station.name,
            line: lineId,
            status: statusInfo.es,
            statusEn: statusInfo.en,
            severity: stationSeverity,
            connectedLines,
            code: stationStatusCode // Track raw status code
          };

          severityDetails.stations.push(stationEntry);
          totalSeverity += stationSeverity;

          // Only add to transfers if it's a real transfer point (has connections to other lines)
          if (connectedLines.length > 0) {
            severityDetails.transfers.push({
              station: stationId,
              name: station.name,
              lines: [lineId, ...connectedLines],
              totalSeverity: stationSeverity,
              status: statusInfo.es,
              statusEn: statusInfo.en,
              code: stationStatusCode
            });
          }
        }
      });
    });

    // Second pass: identify affected segments
    Object.entries(rawData).forEach(([lineId, lineData]) => {
      if (!lineId.startsWith('l')) return;
      if (lineData.estado == null) {
        logger.warn(`[StatusProcessor] Missing 'estado' property for lineId: ${lineId} in second pass`);
        return;
      }
      const statusCode = lineData.estado.toString();
      if (['0', '1', '5'].includes(statusCode)) return;
      
      const stationOrder = (lineData.estaciones || []).map(s => s.codigo.toLowerCase());
      const isAffected = station => 
        !['0', '1', '5'].includes(station.status.code.toString());
      
      const segments = stationGrouper.groupStationsByStatus(
        stationOrder, 
        allStations, 
        isAffected
      );

      if (segments.length > 0) {
        const statusInfo = this._getStatusInfo(statusCode, 'line', lineId);
        affectedSegments[lineId] = segments.map(segment => ({
          line: lineId,
          status: statusInfo.es,
          statusEn: statusInfo.en,
          stations: segment.stations.map(s => s.code.toUpperCase()),
          firstStation: segment.firstStation.code.toUpperCase(),
          lastStation: segment.lastStation.code.toUpperCase(),
          count: segment.count,
          severity: this._calculateLineSeverity(lineId, statusCode),
          code: statusCode
        }));
      }
    });

    // Calculate network status with proper status code handling
    const networkStatus = this._getOverallNetworkStatus(severityDetails, affectedSegments);
    const statusCode = this._getNetworkStatusCode(severityDetails);

    return {
      status: networkStatus.status,
      statusEn: networkStatus.statusEn,
      statusCode,
      networkScale: networkStatus.networkScale,
      totalSeverity,
      severityLabel: this._getSeverityLabel(totalSeverity, 'es'),
      severityLabelEn: this._getSeverityLabel(totalSeverity, 'en'),
      details: severityDetails,
      segments: affectedSegments,
      summary: {
        es: this._generateSpanishSummary(networkStatus, severityDetails, affectedSegments, totalSeverity),
        en: this._generateEnglishSummary(networkStatus, severityDetails, affectedSegments, totalSeverity)
      },
      timestamp: this.timeHelpers.currentTime.toISOString()
    };
  }

  _getNetworkStatusCode(details) {
    const lineStatusCodes = new Set();
    let hasClosedStations = false;
    let hasPartialStations = false;
    let hasDelayedStations = false;
    let hasSuspendedLines = false;

    // Analyze line statuses as strings
    Object.values(details.lines).forEach(line => {
      const code = line.code?.toString() || line.status?.code?.toString();
      if (code) {
        lineStatusCodes.add(code);
        if (code === '2') hasSuspendedLines = true;
      }
    });

    // Analyze station statuses as strings
    details.stations.forEach(station => {
      const code = station.code?.toString() || station.status?.code?.toString();
      if (code === '2') hasClosedStations = true;
      if (code === '3') hasPartialStations = true;
      if (code === '4') hasDelayedStations = true;
    });

    // 1. Check for complete network closure
    if (lineStatusCodes.size === 1 && lineStatusCodes.has('2') && 
        details.stations.every(s => (s.code?.toString() || s.status?.code?.toString()) === '2')) {
      return '2';
    }

    // 2. Check for complete partial service
    if (lineStatusCodes.size === 1 && lineStatusCodes.has('3') && 
        details.stations.every(s => (s.code?.toString() || s.status?.code?.toString()) === '3')) {
      return '3';
    }

    // 3. Check for complete delays
    if (lineStatusCodes.size === 1 && lineStatusCodes.has('4') && 
        details.stations.every(s => (s.code?.toString() || s.status?.code?.toString()) === '4')) {
      return '4';
    }

    // 4. Priority checks for mixed conditions
    if (hasClosedStations) return '7';          // Some stations closed
    if (hasSuspendedLines) return '2';          // Some lines suspended
    if (hasPartialStations) return '3';         // Some partial service (stations)
    if (lineStatusCodes.has('3')) return '3';   // Some partial service (lines)
    if (hasDelayedStations) return '4';         // Some delayed stations
    if (lineStatusCodes.has('4')) return '4';   // Some delayed lines
    if (lineStatusCodes.has('5')) return '5';   // Extended service
    if (lineStatusCodes.has('0')) return '0';   // Off-hours

    // Default to operational
    return '1';
  }

  _getOverallNetworkStatus(details, segments) {
    const statusCode = this._getNetworkStatusCode(details);

    const statusMap = {
      '0': { 
        status: 'Fuera de horario de servicio', 
        statusEn: 'Off-hours service',
        networkScale: 0
      },
      '1': { 
        status: 'Toda la red operativa', 
        statusEn: 'Full network operational',
        networkScale: 1
      },
      '2': { 
        status: 'Servicio suspendido', 
        statusEn: 'Service suspended',
        networkScale: 10
      },
      '3': { 
        status: 'Servicio parcial', 
        statusEn: 'Partial service',
        networkScale: 7
      },
      '4': { 
        status: 'Demoras en la red', 
        statusEn: 'Network delays',
        networkScale: 5
      },
      '5': { 
        status: 'Servicio extendido', 
        statusEn: 'Extended service',
        networkScale: 2
      },
      '7': { 
        status: 'Estaciones cerradas', 
        statusEn: 'Stations closed',
        networkScale: 8
      }
    };

    const result = statusMap[statusCode] || statusMap['1'];

    // Add status counts for reporting
    const statusCounts = {
      suspended: 0,
      partial: 0,
      delayed: 0,
      operational: 0,
      extended: 0,
      offHours: 0,
      closedStations: 0
    };

    Object.values(details.lines).forEach(line => {
      const code = line.code?.toString() || line.status?.code?.toString();
      if (code === '0') statusCounts.offHours++;
      else if (code === '1') statusCounts.operational++;
      else if (code === '2') statusCounts.suspended++;
      else if (code === '3') statusCounts.partial++;
      else if (code === '4') statusCounts.delayed++;
      else if (code === '5') statusCounts.extended++;
    });

    details.stations.forEach(station => {
      const code = station.code?.toString() || station.status?.code?.toString();
      if (code === '2') statusCounts.closedStations++;
    });

    return {
      ...result,
      statusCode,
      statusCounts
    };
  }

  _calculateLineSeverity(lineId, statusCode) {
    const code = statusCode.toString();
    if (!this.statusMap[code] || typeof this.statusMap[code].severity === 'undefined') {
      logger.warn(`[StatusProcessor] Unknown or invalid line status code '${code}' for line ${lineId}. Treating as 0 severity.`);
      return 0;
    }
    return this.lineWeights[lineId] * this.statusMap[code].severity;
  }

  _calculateStationSeverity(station, lineId) {
    if (station.status == null) {
      return 0;
    }
    const statusCode = station.status.toString();
    if (['0', '1', '5'].includes(statusCode)) return 0;

    if (!this.statusMap[statusCode] || typeof this.statusMap[statusCode].severity === 'undefined') {
      logger.warn(`[StatusProcessor] Unknown or invalid station status code '${statusCode}' for station ${station.code}. Treating as 0 severity.`);
      return 0;
    }

    const connectedLines = (station.transfer || '')
      .split(',')
      .map(l => l.trim().toLowerCase());

    const transferWeight = connectedLines.reduce((acc, curr) => {
      return acc + (this.lineWeights[curr] || 0);
    }, this.lineWeights[lineId] || 0);

    return transferWeight * this.statusMap[statusCode].severity;
  }

  _getSeverityLabel(score, lang = 'es') {
    const labels = this.severityLabels[lang].slice().reverse();
    return labels.find(l => score >= l.threshold)?.label || 'Desconocida';
  }

  _mapNetworkStatus(status) {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('operativa')) {
      return 'operational';
    }
    if (statusLower.includes('suspendido')) {
      return 'outage';
    }
    return 'degraded';
  }

  _generateSpanishSummary(networkStatus, details, segments, totalSeverity) {
    const criticalLines = Object.values(details.lines)
      .sort((a, b) => b.severity - a.severity)
      .slice(0, 3);

    const segmentEntries = Object.entries(segments).flatMap(([lineId, lineSegments]) => 
      lineSegments.map(seg => ({
        linea: `L${lineId.slice(1)}`,
        segmento: `${seg.firstStation} ↔ ${seg.lastStation}`,
        estaciones: seg.count,
        estado: seg.status,
        severidad: seg.severity,
        codigo: seg.code
      }))
    );

    const affectedTransfers = details.transfers
      .filter(t => t.totalSeverity > 0)
      .map(t => ({
        estacion: t.station.toUpperCase(),
        nombre: t.name,
        lineas: t.lines.map(l => `L${l.slice(1)}`).join(' ↔ '),
        estado: t.status,
        severidad: t.totalSeverity,
        codigo: t.code
      }));

    return {
      estadoGeneral: networkStatus.status,
      escalaRed: networkStatus.networkScale,
      severidadTotal: totalSeverity,
      nivelSeveridad: this._getSeverityLabel(totalSeverity, 'es'),
      codigoEstado: networkStatus.statusCode,
      resumenDetallado: {
        lineasAfectadas: Object.values(details.lines)
          .sort((a, b) => b.severity - a.severity)
          .map(l => ({
            linea: l.name,
            estado: l.status,
            severidad: l.severity,
            codigo: l.code
          })),
        segmentosCriticos: segmentEntries,
        transferenciasAfectadas: affectedTransfers,
        estacionesCriticas: details.stations
          .sort((a, b) => b.severity - a.severity)
          .slice(0, 5)
          .map(s => ({
            estacion: s.name,
            lineas: [s.line, ...s.connectedLines].map(l => `L${l.slice(1)}`).join(' + '),
            estado: s.status,
            severidad: s.severity,
            codigo: s.code
          }))
      }
    };
  }

  _generateEnglishSummary(networkStatus, details, segments, totalSeverity) {
    const criticalLines = Object.values(details.lines)
      .sort((a, b) => b.severity - a.severity)
      .slice(0, 3);

    const segmentEntries = Object.entries(segments).flatMap(([lineId, lineSegments]) => 
      lineSegments.map(seg => ({
        line: `L${lineId.slice(1)}`,
        segment: `${seg.firstStation} ↔ ${seg.lastStation}`,
        stations: seg.count,
        status: seg.statusEn,
        severity: seg.severity,
        code: seg.code
      }))
    );

    const affectedTransfers = details.transfers
      .filter(t => t.totalSeverity > 0)
      .map(t => ({
        station: t.station.toUpperCase(),
        name: t.name,
        lines: t.lines.map(l => `L${l.slice(1)}`).join(' ↔ '),
        status: t.statusEn,
        severity: t.totalSeverity,
        code: t.code
      }));

    return {
      overallStatus: networkStatus.statusEn,
      networkScale: networkStatus.networkScale,
      totalSeverity,
      severityLevel: this._getSeverityLabel(totalSeverity, 'en'),
      statusCode: networkStatus.statusCode,
      detailedSummary: {
        affectedLines: Object.values(details.lines)
          .sort((a, b) => b.severity - a.severity)
          .map(l => ({
            line: l.name,
            status: l.statusEn,
            severity: l.severity,
            code: l.code
          })),
        criticalSegments: segmentEntries,
        affectedTransfers,
        criticalStations: details.stations
          .sort((a, b) => b.severity - a.severity)
          .slice(0, 5)
          .map(s => ({
            station: s.name,
            lines: [s.line, ...s.connectedLines].map(l => `L${l.slice(1)}`).join(' + '),
            status: s.statusEn,
            severity: s.severity,
            code: s.code
          }))
      }
    };
  }

_getStatusInfo(code, type = 'line', id = 'unknown') {
    const statusInfo = this.statusMap[code.toString()];
    if (!statusInfo) {
      logger.warn(`[StatusProcessor] Unknown ${type} status code '${code}' for ID ${id}. Using default status.`);
      return { es: 'Estado desconocido', en: 'Unknown status' };
    }
    return statusInfo;
  }

  // In the _transformLine method:
_transformLine(lineId, lineData) {
    const status = lineData.status;
    const statusCode = status != null ? status.toString() : 'unknown';
    const statusInfo = this._getStatusInfo(statusCode, 'line', lineId);

    return {
      id: lineId,
      name: `Línea ${lineId.slice(1)}`,
      displayName: `Línea ${lineId.toUpperCase().replace("L", "")}`,
      color: styles.lineColors[lineId] || '#CCCCCC',
      status: {
        code: status,
        message: lineData.message || '',
        appMessage: lineData.app_message || lineData.message || '',
        normalized: statusInfo.es,
        normalizedEn: statusInfo.en
      },
      stations: (lineData.stations || []).map(s => s.code.toLowerCase()),
      // Only include expressSupressed if it's true
      ...(lineData.expressSupressed === true && { expressSupressed: true })
    };
}

// In the _transformStation method:
_transformStation(station, lineId) {

     // console.log(station);
  
    const status = station.status;
    const statusCode = status != null ? status.toString() : 'unknown';
    const statusInfo = this._getStatusInfo(statusCode, 'station', station.code);

    const transferLines = station.transfer
      ? station.transfer.split(',').map(l => l.trim().toLowerCase())
      : [];

    return {
      code: station.code.toUpperCase(),
      name: station.name,
      displayName: station.name,
      line: lineId,
      status: {
        code: status,
        message: station.description || '',
        appMessage: station.app_description || station.description || '',
        normalized: statusInfo.es,
        normalizedEn: statusInfo.en
      },
      transferLines,
      lastUpdated: this.timeHelpers.currentTime.toISOString(),
      // Explicitly add all fields from the station object
      services: station.services,
      amenities: station.amenities,
      image_url: station.image_url,
      transfer: station.transfer,
      transports: station.transports,
      accessibility: station.accessibility,
      commerce: station.commerce,
      commune: station.commune,
      address: station.address,
      latitude: station.latitude,
      longitude: station.longitude,
      location: station.location,
      opened_date: station.opened_date,
      last_renovation_date: station.last_renovation_date,
      access_details: station.access_details,
      // Only include these properties if they're true
      ...(station.isTransferOperational === true && { isTransferOperational: true }),
      ...(station.accessPointsOperational === true && { accessPointsOperational: true })
    };
}

  _generateVersion() {
    const now = this.timeHelpers.currentTime;
    return [
      now.year(),
      (now.month() + 1).toString().padStart(2, '0'),
      now.date().toString().padStart(2, '0'),
      now.hours().toString().padStart(2, '0'),
      now.minutes().toString().padStart(2, '0')
    ].join('');
  }
}

module.exports = StatusProcessor;

