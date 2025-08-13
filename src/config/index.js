const metroConfig = require('./metro/metroConfig');
const styles = {};
const chronosConfig = require('./chronosConfig');

// Merge all configurations with proper namespacing
module.exports = {
    metro: {
        ...metroConfig,
        styles
    },
    chronos: chronosConfig,

    // Utility methods
    getLineColor: (lineId) => styles.lineColors[lineId.toLowerCase()] || '#CCCCCC',
    getStatusColor: (status) => styles.statusColors[status.toLowerCase()] || '#FFFFFF',

    // Validation (re-export from chronos)
    validateSchedule: chronosConfig.validateSchedule
};