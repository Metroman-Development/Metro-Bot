const path = require('path');
const fs = require('fs').promises;
const styles = require('../../../../config/metro/styles.json');
const estadoRedTemplate = require('../../../../templates/estadoRed.json');

module.exports = {
  source: 'linesData.json + estadoRedDetalle.php',
  async load() {
    const trainData = await require('./trainLoader').load();
    const rawLinesData = await this._loadFile('linesData.json');
    return this._transform(rawLinesData, trainData);
  },

  async _loadFile(filename) {
    const data = await fs.readFile(path.join(__dirname, '../json', filename), 'utf8');
    return JSON.parse(data);
  },

  _transform(rawLines, trainData) {
    return Object.entries(rawLines).reduce((acc, [lineId, data]) => {
      const id = lineId.toLowerCase();
      const lineTemplate = estadoRedTemplate[lineId.toUpperCase()] || {};
      
      acc[id] = {
        id,
        displayName: `Línea ${lineId.toUpperCase()}`,
        color: styles.lineColors[id] || '#CCCCCC',
        status: {
          code: lineTemplate.estado || "1",
          message: lineTemplate.mensaje || "",
          appMessage: lineTemplate.mensaje_app || "Línea disponible"
        },
        fleet: this._mapFleet(data.Flota, trainData),
        details: {
          length: data.Longitud,
          stations: data['N° estaciones'],
          inauguration: data.Estreno,
          communes: data.Comunas || []
        },
        infrastructure: {
          operationalStatus: lineTemplate.estado === "1" ? "operational" : "inactive",
          lastUpdated: new Date(),
          stationCodes: lineTemplate.estaciones 
            ? lineTemplate.estaciones.map(s => s.codigo) 
            : []
        }
      };
      return acc;
    }, {});
  },

  _mapFleet(fleetList, trainData) {
    return (fleetList || []).map(modelId => ({
      id: modelId,
      ...trainData[modelId],
      image: trainData[modelId]?.images?.exterior || null
    }));
  }
};
