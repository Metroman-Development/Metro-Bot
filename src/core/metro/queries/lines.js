// modules/metro/queries/lines.js
const linesData = {};
const metroConfig = require('../../../config/metro/metroConfig');
const EXPRESS_LINES = new Set(metroConfig.expressLines);

module.exports = (core) => ({
    getLineInfo: (lineId) => {
        const metroData = core.getLine(lineId);
        const staticData = linesData[lineId] || {};

        return {
            id: lineId,
            name: `Line ${lineId.replace('l', '').toUpperCase()}`,
            status: metroData?.status || 'unknown',
            length: staticData.Longitud || 'N/A',
            inauguration: staticData.Estreno || 'N/A',
            stationsCount: metroData?.stations?.length || 0,
            electrification: staticData.Electrificación || 'N/A',
            rollingStock: staticData.Flota || [],
            characteristics: staticData.Características || 'N/A',
            municipalities: staticData.Comunas || []
        };
    },

    getAllExpressLines: () => Array.from(EXPRESS_LINES),

    getLineStatus: (lineId) => {
        const line = core.getLine(lineId);
        return line ? line.status : 'unknown';
    },

    getExpressSchedule: (lineId) => {
        if (!EXPRESS_LINES.has(lineId)) return null;
        return metroConfig.horarioExpreso[lineId] || {};
    }
});