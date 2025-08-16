// modules/status/utils/StatusProcessor.js
// modules/status/utils/StatusProcessor.js
// modules/embeds/StatusEmbedBuilder.js
// modules/status/utils/StatusProcessor.js

// modules/status/utils/StatusProcessor.js
// modules/status/utils/StatusProcessor.js
// modules/status/utils/StatusProcessor.js
const { normalizeStatus } = require('./statusHelpers');
const logger = require('../../../events/logger');
const styles = require('../../../config/styles.json');
const TimeHelpers = require('../../chronos/timeHelpers');
const stationGrouper = require('../../../templates/utils/stationGrouper');
const statusConfig = require('../../../config/metro/statusConfig');
const DatabaseManager = require('../../database/DatabaseManager');

class StatusProcessor {
  constructor(metroCore, dbManager) {
    this.metro = metroCore;
    this.db = dbManager;
    this.timeHelpers = TimeHelpers;
    this.lineWeights = statusConfig.lineWeights;
    this.statusMap = statusConfig.statusMap;
    this.severityLabels = statusConfig.severityLabels;
  }

  async processRawAPIData(rawData) {
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
          lastUpdated: networkStatusDetails.timestamp
      };

      // Process lines and stations
      const lines = {};
      const stations = {};

      Object.entries(dataToProcess).forEach(([lineId, lineData]) => {
        if (!lineId.startsWith('l')) return;

        // Process line
        lines[lineId] = this._transformLine(lineId, lineData);

        // Process stations
        (lineData.estaciones || []).forEach(station => {
          const stationId = station.codigo.toLowerCase();
          stations[stationId] = this._transformStation(station, lineId);
        });
      });

      const processedData = {
        network,
        lines,
        stations,
        version,
        lastUpdated: timestamp.toISOString(),
        isFallback: false
      };

      await this._updateDatabase(processedData);

      return processedData;
    } catch (error) {
      logger.error('[StatusProcessor] Processing failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async _updateDatabase(data) {
    const db = this.db;
    if (!db) {
      logger.error('[StatusProcessor] Database connection not available.');
      return;
    }

    try {
      await db.transaction(async (connection) => {
        const lineQueries = [];
        const lineStatusQueries = [];
        const stationQueries = [];
        const stationStatusQueries = [];
        const stationHistoryQueries = [];
        const statusChangeLogQueries = [];

        // Prepare line queries
        for (const line of Object.values(data.lines)) {
          lineQueries.push({
            sql: `INSERT INTO metro_lines (line_id, line_name, line_color, status_code, status_message, app_message)
                  VALUES (?, ?, ?, ?, ?, ?)
                  ON DUPLICATE KEY UPDATE
                    line_name = VALUES(line_name),
                    line_color = VALUES(line_color),
                    status_code = VALUES(status_code),
                    status_message = VALUES(status_message),
                    app_message = VALUES(app_message),
                    updated_at = NOW()`,
            params: [line.id, line.name, line.color, line.status.code, line.status.message, line.status.appMessage]
          });

          const statusTypeId = await this._getStatusTypeId(connection, line.status.code);
          if (statusTypeId) {
            lineStatusQueries.push({
              sql: `INSERT INTO line_status (line_id, status_type_id, status_description, status_message, last_updated, updated_by)
                    VALUES (?, ?, ?, ?, NOW(), 'system')
                    ON DUPLICATE KEY UPDATE
                      status_type_id = VALUES(status_type_id),
                      status_description = VALUES(status_description),
                      status_message = VALUES(status_message),
                      last_updated = NOW()`,
              params: [line.id, statusTypeId, line.status.normalized, line.status.message]
            });
          }
        }

        // Execute line queries first to ensure foreign key constraints are met
        for (const query of [
          ...lineQueries,
          ...lineStatusQueries,
        ]) {
          await connection.query(query.sql, query.params);
        }

        // Prepare station queries
        for (const station of Object.values(data.stations)) {
          const fullStationData = this.metro.getStationManager().get(station.id);

          let [stationRow] = await connection.query('SELECT station_id FROM metro_stations WHERE line_id = ? AND station_code = ?', [station.line, station.id]);
          let station_id;

          if (stationRow) {
            station_id = stationRow.station_id;
            stationQueries.push({
              sql: `UPDATE metro_stations SET
                      station_name = ?, display_name = ?, transports = ?, services = ?,
                      accessibility = ?, commerce = ?, amenities = ?, image_url = ?,
                      access_details = ?, updated_at = NOW()
                    WHERE station_id = ?`,
              params: [
                station.name,
                station.displayName,
                fullStationData?.transports,
                fullStationData?.services,
                fullStationData?.accessibility,
                fullStationData?.commerce,
                fullStationData?.amenities,
                fullStationData?.image,
                JSON.stringify(fullStationData?.accessDetails),
                station_id
              ]
            });
          } else {
            const [result] = await connection.query(
              `INSERT INTO metro_stations (line_id, station_code, station_name, display_name, location,
                                        transports, services, accessibility, commerce, amenities, image_url, access_details)
               VALUES (?, ?, ?, ?, POINT(0,0), ?, ?, ?, ?, ?, ?, ?)`,
              [
                station.line,
                station.id,
                station.name,
                station.displayName,
                fullStationData?.transports,
                fullStationData?.services,
                fullStationData?.accessibility,
                fullStationData?.commerce,
                fullStationData?.amenities,
                fullStationData?.image,
                JSON.stringify(fullStationData?.accessDetails)
              ]
            );
            station_id = result.insertId;
          }

          const statusTypeId = await this._getStatusTypeId(connection, station.status.code);
          if (statusTypeId) {
            const [currentStatus] = await connection.query('SELECT status_type_id FROM station_status WHERE station_id = ?', [station_id]);

            if (!currentStatus || currentStatus.status_type_id !== statusTypeId) {
              if (currentStatus) {
                stationHistoryQueries.push({
                  sql: 'INSERT INTO station_status_history (status_id, station_id, status_type_id, status_description, status_message, last_updated, updated_by) SELECT status_id, station_id, status_type_id, status_description, status_message, last_updated, updated_by FROM station_status WHERE station_id = ?',
                  params: [station_id]
                });
                statusChangeLogQueries.push({
                  sql: "INSERT INTO status_change_log (station_id, line_id, old_status_type_id, new_status_type_id, change_description, changed_by) VALUES (?, ?, ?, ?, ?, 'system')",
                  params: [station_id, station.line, currentStatus.status_type_id, statusTypeId, `Status changed from ${currentStatus.status_type_id} to ${statusTypeId}`]
                });
              }
              stationStatusQueries.push({
                sql: 'INSERT INTO station_status (station_id, status_type_id, status_description, status_message, last_updated, updated_by) VALUES (?, ?, ?, ?, NOW(), "system") ON DUPLICATE KEY UPDATE status_type_id = VALUES(status_type_id), status_description = VALUES(status_description), status_message = VALUES(status_message), last_updated = NOW()',
                params: [station_id, statusTypeId, station.status.normalized, station.status.message]
              });
            }
          }
        }

        // Execute station queries
        for (const query of [
          ...stationQueries,
          ...stationHistoryQueries,
          ...statusChangeLogQueries,
          ...stationStatusQueries,
        ]) {
          await connection.query(query.sql, query.params);
        }
      });
      logger.info('[StatusProcessor] Database updated successfully.');
    } catch (error) {
      logger.error('[StatusProcessor] Database update failed', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  async _getStatusTypeId(db, statusCode) {
    try {
        const [mapping] = await db.query('SELECT status_type_id FROM js_status_mapping WHERE js_code = ?', [statusCode]);
        return mapping ? mapping.status_type_id : null;
    } catch(error) {
        logger.error(`Error getting status type id for code ${statusCode}`, error);
        return null;
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

