// intermodalLoader.js
// intermodalLoader.js
const path = require('path');
const fs = require('fs').promises;

module.exports = {
  source: 'intermodalInfo.json + intermodalBuses.json',
  async load() {
    const [info, buses] = await Promise.all([
      this._loadFile('intermodalInfo.json'),
      this._loadFile('intermodalBuses.json')
    ]);
    return this._transform(info, buses);
  },

  async _loadFile(filename) {
    const data = await fs.readFile(path.join(__dirname, '../json', filename), 'utf8');
    return JSON.parse(data);
  },

  _transform(info, buses) {
    return Object.entries(info).reduce((acc, [name, data]) => {
      const normalizedName = this._normalizeName(name);
      acc[normalizedName] = {
        id: normalizedName,
        // Preserve all original data under _raw for backwards compatibility
        _raw: { ...data },
        // Standardized fields
        services: data.Servicios || [],
        buses: this._enhanceBusData(buses[name] || []),
        location: data.Ubicación || 'N/A',
        // Additional fields from original data
        comuna: data.Comuna || 'N/A',
        inauguration: data.Inauguración || 'N/A',
        platforms: data['N.º de andenes'] || 'N/A',
        operator: data.Operador || 'N/A'
      };
      return acc;
    }, {});
  },

  _enhanceBusData(buses) {
    return buses.map(bus => {
      if (typeof bus === 'string') {
        // Convert string format to object format for consistency
        const parts = bus.split(' ');
        return {
          'Tipo Servicio': 'Red',
          'Recorrido/Operador': parts[0],
          Destino: parts.slice(1).join(' ') || 'N/A'
        };
      }
      return bus;
    });
  },

  _normalizeName(name) {
    return name.toLowerCase().replace(/\s+/g, '_');
  }
};