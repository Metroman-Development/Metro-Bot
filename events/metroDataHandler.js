/*const { validateAgainstTemplate } = require('../database/dataValidators');
const db = require('../utils/database');
const logger = require('./logger');
const metroConfig = require('../config/metroConfig');
const apiTemplate = require('../data/estadoRedDetalle.php.json');

// Cache system
let cache = {
  data: null,
  lastUpdated: null,


} 
let metroData = null;
// Helper function to deep clone data
function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

// Generate a valid closed state based on template
function generateClosedState() {
  const closedState = cloneData(apiTemplate);
  for (const lineKey in closedState) {
    closedState[lineKey].estado = '0';
    closedState[lineKey].mensaje = 'Cierre por Horario';
    closedState[lineKey].estaciones.forEach(station => {
      station.estado = '0';
      station.descripcion = 'Estación Cerrada por Horario';
    });
  }
  return closedState;
}

// Transform API data to match our template
function transformAPIData(apiData) {
  const transformed = {};
  
  for (const lineKey in apiTemplate) {
    if (apiData[lineKey]) {
      transformed[lineKey] = {
        estado: apiData[lineKey].estado || '0',
        mensaje: apiData[lineKey].mensaje || '',
        mensaje_app: apiData[lineKey].mensaje_app || 'Servicio no disponible',
        estaciones: (apiData[lineKey].estaciones || []).map(station => ({
          nombre: station.nombre || 'Desconocida',
          codigo: station.codigo || 'XX',
          estado: station.estado || '0',
          combinacion: station.combinacion || '',
          descripcion: station.descripcion || 'Estado desconocido',
          descripcion_app: station.descripcion_app || 'Estado desconocido',
          mensaje: station.mensaje || ''
        }))
      };
    } else {
      // Fill missing lines with closed state
      transformed[lineKey] = {
        estado: '0',
        mensaje: 'Línea no disponible',
        mensaje_app: 'Línea no disponible',
        estaciones: apiTemplate[lineKey].estaciones.map(station => ({
          ...station,
          estado: '0',
          descripcion: 'Estación no disponible'
        }))
      };
    }
  }
  
  return transformed;
}

async function fetchMetroData() {
  try {
    logger.info('Fetching data from Metro API');
    const response = await fetch(metroConfig.apiEndpoint);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const apiData = await response.json();
    
    
    await storeData(apiData);
    return apiData;
  } catch (error) {
    logger.error('API fetch failed:', error);
    const dbData = await getLatestValidDatabaseData();
    return dbData || generateClosedState();
  }
}

async function getLatestValidDatabaseData() {
  try {
    const [rows] = await db.query(`
      SELECT data FROM metro_data_history 
      WHERE state_type = 'normal'
      ORDER BY timestamp DESC 
      LIMIT 1
    `);
    
    if (!rows.length) return null;
    
    const data = typeof rows[0].data === 'string' ? 
      JSON.parse(rows[0].data) : 
      rows[0].data;
    
    validateAgainstTemplate(data);
    return data;
  } catch (error) {
    logger.error('Database retrieval failed:', error);
    return null;
  }
}

async function storeData(data) {
   
    
  cache.data=data;
    metroData=data;
  try {
    validateAgainstTemplate(data);
    await db.query(
      'INSERT INTO metro_data_history (data, state_type) VALUES (?, ?)',
      [JSON.stringify(data), 'normal']
    );
    logger.info('Data stored successfully');
  } catch (error) {
    logger.error('Data storage failed:', error);
  }
}

function getCachedMetroData() {
  if (!metroData) {
    logger.warn('No metro data available in cache');
    return null;
  }
  
  // Safe property access
  if (metroData['l1']?.estaciones?.[1]) {
    console.log(metroData['l1'].estaciones[1]);
  }
  
  return metroData;
}

async function getCachedMetroDataWithFallback() {
  // Try cache first
  const cached = getCachedMetroData();
  if (cached) return cached;
  
  // Try database
  const dbData = await getLatestValidDatabaseData();
  if (dbData) {
      console.log("Using database") 
    cache.data = dbData;
    cache.lastUpdated = Date.now();
    return cloneData(dbData);
  }
  
  // Fallback to API
  try {
    const apiData = await fetchMetroData();
    cache.data = apiData;
    cache.lastUpdated = Date.now();
    return cloneData(apiData);
  } catch (error) {
    logger.error('All data sources failed, using closed state');
    return generateClosedState();
  }
}

async function initializeMetroDataFetching(client) {
  try {
    const data = await getCachedMetroDataWithFallback();
    validateAgainstTemplate(data);
    
    cache.data = data;
    cache.lastUpdated = Date.now();
    
    return data;
  } catch (error) {
    logger.error('Initialization failed:', error);
    const closedData = generateClosedState();
    cache.data = closedData;
    cache.lastUpdated = Date.now();
    return closedData;
  }
}

function setClosedState(data) {
  const closedData = cloneData(data);
  for (const lineKey in closedData) {
    closedData[lineKey].estado = '0';
    closedData[lineKey].mensaje = 'Cierre por Horario';
    closedData[lineKey].estaciones.forEach(station => {
      station.estado = '0';
      station.descripcion = 'Estación Cerrada por Horario';
    });
  }
  return closedData;
}

async function forceExtendedService(data) {
  const event = isEventDay();
  if (!event) return cloneData(data);
  
  const extendedData = cloneData(data);
  const extendedStations = event.stations;
  
  for (const lineKey in extendedData) {
    extendedData[lineKey].estaciones.forEach(station => {
      if (extendedStations.includes(station.nombre)) {
        station.estado = '5';
        station.descripcion = 'Operativa con horario extendido';
      }
    });
  }
  
  return extendedData;
}


function generateBaseClosedState() {
  // Create deep clone of the template
  const closedState = JSON.parse(JSON.stringify(apiTemplate));
  
  // Modify all lines and stations to closed state
  for (const lineKey in closedState) {
    if (closedState.hasOwnProperty(lineKey)) {
      // Set line to closed
      closedState[lineKey].estado = '0';
      closedState[lineKey].mensaje = 'Cierre por Horario';
      closedState[lineKey].mensaje_app = 'Metro cerrado';
      
      // Set all stations to closed
      closedState[lineKey].estaciones.forEach(station => {
        station.estado = '0';
        station.descripcion = 'Estación Cerrada por Horario';
        station.descripcion_app = 'Cerrada';
        station.mensaje = 'Cierre por Horario';
        
        // Preserve combination info if exists
        station.combinacion = station.combinacion || '';
      });
    }
  }
  
  return closedState;
}



module.exports = {
  fetchMetroData,
  getCachedMetroData: getCachedMetroDataWithFallback,
  getPreviousData: getLatestValidDatabaseData,
  storePreviousData: storeData,
  initializeMetroDataFetching,
  setClosedState,
  forceExtendedService,
   generateClosedState,
    generateBaseClosedState
    
};
*/