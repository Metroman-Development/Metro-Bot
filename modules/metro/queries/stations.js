// modules/metro/queries/stations.js
const { normalize } = require('../../utils/stringHandlers/normalization');

module.exports = ({ stationsCore, linesCore, amenitiesService }) => {
  const { getStation, indexes } = stationsCore;
  const { getLine } = linesCore;

  // ======================
  // FILTER IMPLEMENTATIONS
  // ======================

  const filterStrategies = {
    // Basic station filters
    name: (station, value) => normalize(station.name).includes(normalize(value)),
    code: (station, value) => station.code.toLowerCase() === value.toLowerCase(),
    status: (station, value) => station.status === value,

    // Line-related filters
    line: (station, lineId) => station.line.toLowerCase() === lineId.toLowerCase(),
    lineStatus: (station, value) => {
      const line = getLine(station.line);
      return line?.status === value;
    },
    lineType: (station, value) => {
      const line = getLine(station.line);
      return line?.type?.toLowerCase() === value.toLowerCase();
    },

    // Accessibility filters
    accessibility: (station, value) => {
      return station.details?.accessibility?.toLowerCase() === value.toLowerCase();
    },
    hasElevator: (station) => station.amenities?.includes('elevator'),
    hasWheelchairAccess: (station) => 
      station.details?.accessibility === 'full',

    // Amenity filters
    amenity: (station, amenity) => {
      return amenitiesService.hasAmenity(station.code, amenity);
    },
    hasBathroom: (station) => station.amenities?.includes('bathroom'),
    hasWifi: (station) => station.amenities?.includes('wifi'),

    // Transfer/connection filters
    hasTransfer: (station) => !!station.transfer,
    transferTo: (station, lineId) => {
      if (!station.transfer) return false;
      return station.transfer.split(',').some(t => 
        t.trim().toLowerCase() === lineId.toLowerCase()
      );
    },

    // Special service filters
    hasBikeParking: (station) => station.services?.includes('bike_parking'),
    hasMetroBus: (station) => station.services?.includes('metrobus'),
    isExpress: (station) => station.route?.includes('express'),

    // Location-based filters
    zone: (station, zone) => station.zone?.toLowerCase() === zone.toLowerCase(),
    municipality: (station, value) => 
      station.details?.municipality?.toLowerCase() === value.toLowerCase()
  };

  // ======================
  // PUBLIC API
  // ======================

  const applyFilters = (station, filters) => {
    return Object.entries(filters).every(([filterKey, filterValue]) => {
      const strategy = filterStrategies[filterKey];
      if (!strategy) {
        console.warn(`Unknown filter: ${filterKey}`);
        return true; // Skip unknown filters
      }
      return strategy(station, filterValue);
    });
  };

  return {
    /**
     * Search stations with advanced filtering
     * @param {Object} filters - Key-value pairs of filters
     * @example
     * search({
     *   name: 'heroes', 
     *   lineStatus: 'operational',
     *   hasWifi: true,
     *   municipality: 'santiago'
     * })
     */
    search: (filters = {}) => {
      return Array.from(indexes.stations.values())
        .filter(station => applyFilters(station, filters))
        .map(station => ({
          ...station,
          // Add computed fields
          isTransfer: !!station.transfer,
          lineStatus: getLine(station.line)?.status
        }));
    },

    /**
     * Get station with exact matching
     * @param {string} identifier - Station code or name
     * @param {Object} filters - Additional filters
     */
    get: (identifier, filters = {}) => {
      const station = getStation(identifier);
      return station && applyFilters(station, filters) ? station : null;
    },

    // Specialized filter methods
    getAccessibleStations: () => 
      this.search({ accessibility: 'full' }),
      
    getStationsWithAmenity: (amenity) => 
      this.search({ amenity }),
      
    getTransferStations: () => 
      this.search({ hasTransfer: true })
  };
};