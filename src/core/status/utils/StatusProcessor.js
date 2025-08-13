// modules/status/utils/StatusProcessor.js
// modules/status/utils/StatusProcessor.js
// modules/embeds/StatusEmbedBuilder.js
// modules/status/utils/StatusProcessor.js

// modules/status/utils/StatusProcessor.js
// modules/status/utils/StatusProcessor.js
// modules/status/utils/StatusProcessor.js
const { normalizeStatus } = require('./statusHelpers');
const logger = require('../../../events/logger');
const styles = require('../../../config/metro/styles.json');
const TimeHelpers = require('../../chronos/timeHelpers');
const stationGrouper = require('../../../templates/utils/stationGrouper');
const statusConfig = require('../../../config/metro/statusConfig');

class StatusProcessor {
  constructor(metroCore) {
    this.metro = metroCore;
    this.timeHelpers = TimeHelpers;
    this.lineWeights = statusConfig.lineWeights;
    this.statusMap = statusConfig.statusMap;
    this.severityLabels = statusConfig.severityLabels;
  }

  processRawAPIData(rawData) {
    try {
      if (!rawData || typeof rawData !== 'object') {
        throw new Error('Invalid rawData received');
      }

      const version = this._generateVersion();
      const timestamp = this.timeHelpers.currentTime;

      // Process network status
      const network = this._transformNetworkStatus(rawData);

      // Process lines and stations
      const lines = {};
      const stations = {};

      Object.entries(rawData).forEach(([lineId, lineData]) => {
        if (!lineId.startsWith('l')) return;

        // Process line
        lines[lineId] = this._transformLine(lineId, lineData);

        // Process stations
        (lineData.estaciones || []).forEach(station => {
          const stationId = station.codigo.toLowerCase();
          stations[stationId] = this._transformStation(station, lineId);
        });
      });

      return {
        network,
        lines,
        stations,
        version,
        lastUpdated: timestamp.toISOString(),
        isFallback: false
      };
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
      const statusCode = lineData.estado.toString();
      lineStatuses[lineId] = statusCode;
      
      const lineSeverity = this._calculateLineSeverity(lineId, statusCode);
      if (lineSeverity > 0) {
        severityDetails.lines[lineId] = {
          name: `Línea ${lineId.slice(1)}`,
          status: this.statusMap[statusCode].es,
          statusEn: this.statusMap[statusCode].en,
          severity: lineSeverity,
          connectedTransfers: [],
          code: statusCode // Track raw status code
        };
        totalSeverity += lineSeverity;
      }

      // Process stations with proper transfer detection
      (lineData.estaciones || []).forEach(station => {
        const stationId = station.codigo.toLowerCase();
        const stationStatusCode = station.estado.toString();
        const transformedStation = this._transformStation(station, lineId);
        allStations[stationId] = transformedStation;
        const stationSeverity = this._calculateStationSeverity(station, lineId);

        if (stationSeverity > 0) {
          let connectedLines = [];
          const hasCombination = station.combinacion && station.combinacion.trim().length > 0;
          
          // Only consider actual transfer stations (must have connections to other lines)
          if (hasCombination) {
            connectedLines = station.combinacion.toLowerCase()
              .split(',')
              .map(line => line.trim())
              .filter(line => line.length > 0 && line !== lineId);
          }

          const stationEntry = {
            id: stationId,
            name: station.nombre,
            line: lineId,
            status: this.statusMap[stationStatusCode].es,
            statusEn: this.statusMap[stationStatusCode].en,
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
              name: station.nombre,
              lines: [lineId, ...connectedLines],
              totalSeverity: stationSeverity,
              status: this.statusMap[stationStatusCode].es,
              statusEn: this.statusMap[stationStatusCode].en,
              code: stationStatusCode
            });
          }
        }
      });
    });

    // Second pass: identify affected segments
    Object.entries(rawData).forEach(([lineId, lineData]) => {
      if (!lineId.startsWith('l')) return;
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
        affectedSegments[lineId] = segments.map(segment => ({
          line: lineId,
          status: this.statusMap[statusCode].es,
          statusEn: this.statusMap[statusCode].en,
          stations: segment.stations.map(s => s.id.toUpperCase()),
          firstStation: segment.firstStation.id.toUpperCase(),
          lastStation: segment.lastStation.id.toUpperCase(),
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
    return this.lineWeights[lineId] * this.statusMap[code].lineSeverityImpact;
  }

  _calculateStationSeverity(station, lineId) {
    const statusCode = station.estado.toString();
    if (['0', '1', '5'].includes(statusCode)) return 0;

    const connectedLines = (station.combinacion || '')
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

  // In the _transformLine method:
_transformLine(lineId, lineData) {
    const statusCode = lineData.estado.toString();
    const statusInfo = this.statusMap[statusCode];
    return {
      id: lineId,
      name: `Línea ${lineId.slice(1)}`,
      displayName: `Línea ${lineId.toUpperCase().replace("L", "")}`,
      color: styles.lineColors[lineId] || '#CCCCCC',
      status: {
        code: lineData.estado,
        message: lineData.mensaje || '',
        appMessage: lineData.mensaje_app || lineData.mensaje || '',
        normalized: statusInfo.es,
        normalizedEn: statusInfo.en
      },
      stations: (lineData.estaciones || []).map(s => s.codigo.toLowerCase()),
      // Only include expressSupressed if it's true
      ...(lineData.expressSupressed === true && { expressSupressed: true })
    };
}

// In the _transformStation method:
_transformStation(station, lineId) {
    const statusCode = station.estado.toString();
    const statusInfo = this.statusMap[statusCode];
    const transferLines = station.combinacion 
      ? station.combinacion.split(',').map(l => l.trim().toLowerCase())
      : [];

    return {
      id: station.codigo.toLowerCase(),
      name: station.nombre,
      displayName: station.nombre,
      line: lineId,
      status: {
        code: station.estado,
        message: station.descripcion || '',
        appMessage: station.descripcion_app || station.descripcion || '',
        normalized: statusInfo.es,
        normalizedEn: statusInfo.en
      },
      transferLines,
      lastUpdated: this.timeHelpers.currentTime.toISOString(),
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

