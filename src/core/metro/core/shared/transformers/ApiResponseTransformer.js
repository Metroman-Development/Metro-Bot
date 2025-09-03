const STATUS_MAP = {
  '0': 'closed',
  '1': 'operational',
  '2': 'delayed',
  '3': 'limited_service'
};

module.exports = class ApiResponseTransformer {
  static transform(apiData) {
    const result = {
      stations: {},
      lines: {},
      systemMetadata: {
        source: 'api',
        lastSync: new Date().toISOString()
      }
    };

    Object.entries(apiData).forEach(([lineId, lineData]) => {
      const normalizedLineId = lineId.toLowerCase();

      result.lines[normalizedLineId] = {
        id: normalizedLineId,
        name: `Línea ${lineId.toUpperCase()}`,
        status: STATUS_MAP[lineData.status] || 'unknown',
        stations: []
      };

      lineData.stations.forEach(apiStation => {
        const stationId = apiStation.code.toLowerCase();

        result.stations[stationId] = {
          id: stationId,
          code: apiStation.code,
          name: apiStation.name,
          line: normalizedLineId,
          status: STATUS_MAP[apiStation.status] || apiStation.status,
          transfers: this._parseTransfers(apiStation.transfer),
          details: this._parseDetails(apiStation),
          metadata: {
            source: 'api',
            updatedAt: new Date().toISOString()
          }
        };

        result.lines[normalizedLineId].stations.push(stationId);
      });
    });

    return result;
  }

  static _parseTransfers(transferString) {
    if (!transferString) return {};
    return transferString.split(',')
      .reduce((acc, line) => {
        const normalized = line.trim().toLowerCase();
        if (normalized) acc[normalized] = true;
        return acc;
      }, {});
  }

  static _parseDetails(station) {
    const details = {};
    
    // Only add amenities if they exist
    if (station.servicios) {
      details.amenities = station.servicios.split(',')
        .map(item => ({
          type: item.trim().toLowerCase(),
          status: 'available'
        }))
        .filter(item => item.type);
    }

    // Add other raw fields without defaults
    if (station.description) details.description = station.description;
    if (station.app_description) details.appDescription = station.app_description;

    return details;
  }
};