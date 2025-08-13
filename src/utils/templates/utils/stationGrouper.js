// templates/utils/stationGrouper.js
module.exports = {
    /**
     * Groups stations by consecutive status
     * @param {Array} stationOrder - Ordered station IDs for the line
     * @param {Object} allStations - All station data
     * @param {Function} statusChecker - Function that returns true for stations to group
     * @returns {Array} Array of grouped station segments
     */
    groupStationsByStatus(stationOrder, allStations, statusChecker) {
        const segments = [];
        let currentSegment = [];

        for (const stationId of stationOrder) {
            const station = allStations[stationId];
            if (station && statusChecker(station)) {
                currentSegment.push(station);
            } else if (currentSegment.length > 0) {
                segments.push(currentSegment);
                currentSegment = [];
            }
        }

        if (currentSegment.length > 0) {
            segments.push(currentSegment);
        }

        return segments.map(segment => ({
            firstStation: segment[0],
            lastStation: segment[segment.length - 1],
            stations: segment,
            count: segment.length,
            status: segment[0].status, // All stations in segment share same status
            statusCode: segment[0].status.code
        }));
    }
};
