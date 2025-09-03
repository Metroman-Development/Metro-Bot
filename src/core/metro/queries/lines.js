// modules/metro/queries/lines.js
const linesData = {};
const metroConfig = require('../../../config/metro/metroConfig');
const EXPRESS_LINES = new Set(metroConfig.expressLines);

module.exports = (core) => ({
    getLineInfo: (lineId) => {
        const lineData = core.getLine(lineId);
        if (!lineData) return null;

        return {
            id: lineId,
            name: lineData.name,
            status: lineData.status,
            length: lineData.total_length_km,
            inauguration: lineData.opening_date,
            stationsCount: lineData.total_stations,
            electrification: lineData.infrastructure?.electrification || 'N/A',
            rollingStock: lineData.fleet_data,
            characteristics: lineData.line_description,
            municipalities: lineData.infrastructure?.communes || []
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