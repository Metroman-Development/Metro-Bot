const STATUS_MAP = {
  '0': 'closed',
  '1': 'operational',
  '2': 'delayed',
  '3': 'limited_service'
};

module.exports = class DatabaseTransformer {
  static normalize(dbData) {
    const result = {
      stations: {},
      lines: {},
      systemMetadata: {
        source: 'database',
        lastSync: dbData.timestamp || new Date().toISOString(),
        databaseVersion: dbData.version
      }
    };

    dbData.stations.forEach(dbStation => {
      const stationId = dbStation.codigo.toLowerCase();
      const details = {};

      // Only add populated fields
      if (dbStation.amenities) {
        details.amenities = this._parseAmenities(dbStation.amenities);
      }
      if (dbStation.municipio) details.municipality = dbStation.municipio;
      if (dbStation.zona) details.zone = dbStation.zona;
      if (dbStation.plataformas) details.platformCount = dbStation.plataformas;

      result.stations[stationId] = {
        id: stationId,
        code: dbStation.codigo,
        name: dbStation.nombre,
        line: dbStation.linea.toLowerCase(),
        status: STATUS_MAP[dbStation.estado] || dbStation.estado,
        transfers: this._parseTransfers(dbStation.combinacion),
        details: details,
        metadata: {
          source: 'database',
          updatedAt: dbStation.updated_at,
          databaseId: dbStation.id
        }
      };
    });

    dbData.lines.forEach(dbLine => {
      const lineId = dbLine.codigo.toLowerCase();

      result.lines[lineId] = {
        id: lineId,
        name: dbLine.nombre,
        status: STATUS_MAP[dbLine.estado] || dbLine.estado,
        type: dbLine.tipo,
        color: dbLine.color,
        stations: dbLine.estaciones.map(s => s.toLowerCase())
      };
    });

    return result;
  }

  static _parseTransfers(transfers) {
    if (!transfers) return {};
    if (Array.isArray(transfers)) {
      return transfers.reduce((acc, line) => {
        acc[line.toLowerCase()] = true;
        return acc;
      }, {});
    }
    return transfers;
  }

  static _parseAmenities(amenities) {
    if (!amenities) return [];
    
    return (Array.isArray(amenities) ? amenities : [amenities])
      .map(item => ({
        type: item.type || item.trim().toLowerCase(),
        status: item.status || 'available',
        ...(item.location && { location: item.location })
      }))
      .filter(item => item.type);
  }
};