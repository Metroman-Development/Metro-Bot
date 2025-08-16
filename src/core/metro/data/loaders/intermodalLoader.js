// intermodalLoader.js
const DatabaseManager = require('../../../database/DatabaseManager');

module.exports = {
  source: 'MetroDB/intermodal_stations & intermodal_buses',
  async load(dbManager) {
    try {
        if (!dbManager) throw new Error('DatabaseManager is not provided to intermodalLoader');
        const stations = await dbManager.query("SELECT * FROM intermodal_stations");
        const buses = await dbManager.query("SELECT * FROM intermodal_buses");
        return this._transform(stations, buses);
    } catch (err) {
        throw err;
    }
  },

  _transform(stations, buses) {
    const busMap = buses.reduce((acc, bus) => {
        if (!acc[bus.station_id]) {
            acc[bus.station_id] = [];
        }
        acc[bus.station_id].push({
            'Tipo Servicio': bus.type,
            'Recorrido/Operador': bus.route,
            'Destino': bus.destination
        });
        return acc;
    }, {});

    return stations.reduce((acc, station) => {
      const normalizedName = this._normalizeName(station.name);
      acc[normalizedName] = {
        id: normalizedName,
        services: JSON.parse(station.services),
        buses: busMap[station.id] || [],
        location: station.location,
        comuna: station.commune,
        inauguration: station.inauguration,
        platforms: station.platforms,
        operator: station.operator
      };
      return acc;
    }, {});
  },

  _normalizeName(name) {
    return name.toLowerCase().replace(/\s+/g, '_');
  }
};