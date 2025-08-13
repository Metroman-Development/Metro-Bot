// modules/metro/core/services/dataTransformers.js
const logger = require('../../../../events/logger');
const metroConfig = require('../../../../config/metro/metroConfig');
const styles = require('../../../../config/styles.json');


module.exports = {
  /**
   * Transforms raw API data to MetroCore format
   * @param {Object} apiData - Raw API response in estadoRedDetalle.php format
   * @returns {Object} Transformed data in MetroCore format
   */
  transformAPIData: (apiData) => {
    try {
      const transformed = {
        network: 'operational',
        lines: {},
        stations: {},
        lastUpdated: new Date(),
        version: metroConfig.dataVersion || '1.0.0'
      };

      // Transform each line
      Object.entries(apiData).forEach(([lineKey, lineData]) => {
        
        console.log(lineKey);
                                      
        const lineId = lineKey;
        const lineStatus = lineData.estado === "1" ? "operational" : "outage";

        transformed.lines[lineId] = {
          id: lineId,
          displayName: lineId,
          status: lineStatus,
          color: styles.lineColors[lineId] || '#000000',
          message: lineData.mensaje_app || '',
          stations: []
        };

        // Transform each station
          
          if(lineData.estaciones){
             
        lineData.estaciones.forEach(station => {
          console.log(station.nombre)
          const stationId = station.codigo.toLowerCase();
          const stationStatus = station.estado === "1" ? "operational" : 
                              station.descripcion_app.toLowerCase() || 'outage';

          transformed.stations[stationId] = {
            id: stationId,
            name: station.nombre,
            displayName: station.nombre,
            line: lineId,
            status: stationStatus,
            transferLines: station.combinacion ? 
                         station.combinacion.split(',').map(l => l.trim().toLowerCase()) : [],
            description: station.descripcion || '',
            lastUpdated: new Date()
          };

          transformed.lines[lineId].stations.push(stationId);
        });}
     
          });
        
       //console.log(transformed);

      console.log('[DataTransformer] Successfully transformed API data');
      return transformed;

    } catch (error) {
      logger.error('[DataTransformer] Transformation failed:', error);
      throw new Error(`DATA_TRANSFORM_FAILED: ${error.message}`);
    }
  },

  /**
   * Generates a normalized station name for search purposes
   * @param {String} name - Original station name
   * @returns {String} Normalized name
   */
  normalizeStationName: (name) => {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')      // Replace special chars with space
      .trim();
  },

  /**
   * Creates a closed state fallback
   * @returns {Object} Closed system state
   */
  
  /**
   * Sets all statuses to closed state (0 and "Cierre por Horario")
   * @param {Object} data - MetroCore format data (will be modified in-place)
   */
  setClosedState: (data) => {
    // Set network status
    if (data._statusData) {
      data._statusData.network = 'outage';
    }

    // Set all lines to closed
    if (data.lines) {
      Object.values(data.lines).forEach(line => {
        line.status = '0';
        if (line._originalData) {
          line._originalData.estado = '0';
          line._originalData.mensaje = 'Cierre por Horario';
        }
      });
    }

    // Set all stations to closed
    if (data.stations) {
      Object.values(data.stations).forEach(station => {
        station.status = '0';
        if (station._originalData) {
          station._originalData.estado = '0';
          station._originalData.descripcion = 'Cierre por Horario';
        }
      });
    }
  }, 

    
  /**
   * Validates transformed data structure
   * @param {Object} data - Transformed data
   * @returns {Boolean} True if valid
   */
  validateStructure: (data) => {
    
   console.log("VALIDANDO");
      
      
    const requiredKeys = ['network', 'lines', 'stations', 'lastUpdated'];
    const lineRequiredKeys = ['id', 'status', 'stations'];
    const stationRequiredKeys = ['id', 'name', 'line', 'status'];

    try {
      // Check top-level structure
      if (!requiredKeys.every(k => data.hasOwnProperty(k))) {
        throw new Error('Missing required top-level keys');
      }

      // Check line structure
      Object.values(data.lines).forEach(line => {
        if (!lineRequiredKeys.every(k => line.hasOwnProperty(k))) {
          throw new Error(`Line ${line.id} missing required keys`);
        }
      });

      // Check station structure
      Object.values(data.stations).forEach(station => {
        if (!stationRequiredKeys.every(k => station.hasOwnProperty(k))) {
          throw new Error(`Station ${station.id} missing required keys`);
        }
      });

      return true;
    } catch (error) {
      logger.error('[DataTransformer] Validation failed:', error);
      return false;
    }
  }
};