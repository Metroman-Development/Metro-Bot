const path = require('path');
const loadJsonFile = require('../../../../utils/jsonLoader');
const styles = { lineColors: {} };
const estadoRedTemplate = {};

module.exports = {
  source: 'linesData.json + estadoRedDetalle.php',
  async load() {
    const trainData = await require('./trainLoader').load();
    const rawLinesData = this._loadFile('linesData.json');
    return this._transform(rawLinesData, trainData);
  },

  _loadFile(filename) {
    return loadJsonFile(path.join(__dirname, '../json', filename));
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
