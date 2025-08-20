const metroConfig = require('../../../config/metro/metroConfig');

const stationStatusMap = {
    '1': '1', // abierta -> abierta
    '2': '5', // cerrada -> cerrada
    '3': '4', // accesos parciales -> accesos parciales
};

const lineStatusMap = {
    '1': '10', // operativa -> operativa
    '2': '13', // algunas estaciones cerradas -> parcial
    '3': '14', // servicio interrumpido -> suspendida
    '4': '17', // demoras -> con demoras
};

function translateApiData(rawData) {
    if (!rawData || !rawData.lineas) {
        return rawData;
    }

    const translatedData = JSON.parse(JSON.stringify(rawData));

    for (const lineId in translatedData.lineas) {
        const line = translatedData.lineas[lineId];

        // Translate line status
        if (lineStatusMap[line.estado]) {
            line.estado = lineStatusMap[line.estado];
        }

        // Translate station statuses
        if (line.estaciones) {
            for (const station of line.estaciones) {
                if (stationStatusMap[station.estado]) {
                    station.estado = stationStatusMap[station.estado];
                }
            }
        }
    }

    return translatedData;
}

module.exports = {
    translateApiData,
};
