// stationLoader.js
// stationLoader.js
const path = require('path');
const fs = require('fs').promises;
const config = require('../../../../config/metro/metroConfig');
const styles = require('../../../../config/metro/styles.json');
const estadoRedTemplate = require('../../../../templates/estadoRed.json');

module.exports = {
  source: 'stations.json + stationConnections.json + stationsData.json + accessDetails/*.json',

  constructor() {
    this._accessDetailsCache = {};
    this._lineSpecificAccessCache = {};
  },

  async load() {
    const [stations, connections, data] = await Promise.all([
      this._loadFile('stations.json'),
      this._loadFile('stationConnections.json'),
      this._loadFile('stationsData.json')
    ]);

    try {
      await this._loadAccessDetails();
      if (data?.stationsData) {
        this._overrideAccessibilityStrings(data.stationsData);
      }
    } catch (e) {
      console.error('Access details failed - using original strings', e);
    }

    return this._transform(stations, connections, data);
  },

  _overrideAccessibilityStrings(stationsData) {
    for (const [rawName, stationData] of Object.entries(stationsData)) {
      const lineMatch = rawName.match(/(l[1-6]|l4a)$/i);
      const lineId = lineMatch ? lineMatch[0].toLowerCase() : null;
      const accessData = this._getAccessDetailsForStation(rawName, lineId);

      if (accessData) {
        stationData[2] = this._buildMimickedAccessibility(stationData[2], accessData);
      }
    }
  },

  _buildMimickedAccessibility(original, accessInfo) {
    let result = 'Todos los Ascensores Disponibles';

    // List ALL elevators
    if (accessInfo.elevators?.length > 0) {
      result += '\n**📃 Ascensores en la estación:**';
      accessInfo.elevators.forEach(elev => {
        result += `\nAscensor desde ${elev.from} hacia ${elev.to}`;
        if (elev?.status?.toLowerCase() !== 'operativa') {
          result = result.replace('Todos los Ascensores Disponibles', '');
          result += ` (Fuera de Servicio)`;
          if (elev.notes) result += ` - ${elev.notes}`;
        }
      });
    }

    // Only show NON-OPERATIONAL escalators
    const nonOperationalEscalators = accessInfo.escalators?.filter(
      e => e?.status?.toLowerCase() !== 'operativa'
    ) || [];
    if (nonOperationalEscalators.length > 0) {
      result += '\n**⚠️ Escaleras mecánicas fuera de servicio:**';
      nonOperationalEscalators.forEach(esc => {
        result += `\nEscala Mecánica desde ${esc.from} hacia ${esc.to}`;
        if (esc.notes) result += ` - ${esc.notes}`;
      });
    }

    // Only show NON-OPERATIONAL accesses
    const nonOperationalAccesses = accessInfo.accesses?.filter(
      a => a?.status?.toLowerCase() !== 'abierto' && a?.status
    ) || [];
    if (nonOperationalAccesses.length > 0) {
      result += '\n**⚠️ Accesos cerrados:**';
      nonOperationalAccesses.forEach(acc => {
        result += `\n- ${acc.name} (${acc.id})`;
        if (acc.description) result += `: ${acc.description}`;
        if (acc.notes) result += ` - ${acc.notes}`;
      });
    }

    if (accessInfo.lastUpdated) {
      result += `\n-# Última actualización: ${accessInfo.lastUpdated.split('T')[0]}`;
    }

    return result;
  },

  async _loadAccessDetails() {
  const accessDir = path.join(__dirname, '../json/accessDetails');
  try {
    const files = await fs.readdir(accessDir);
    const accessFiles = files.filter(file => file.startsWith('access_') && file.endsWith('.json'));
    
    // Initialize caches if they don't exist
    this._accessDetailsCache = this._accessDetailsCache || {};
    this._lineSpecificAccessCache = this._lineSpecificAccessCache || {};
    
    await Promise.all(accessFiles.map(async file => {
      try {
        const content = await fs.readFile(path.join(accessDir, file), 'utf8');
        const data = JSON.parse(content);
        
        if (!data.station) {
          console.error(`Access file ${file} is missing station property`);
          return;
        }
        
        const lineFromFilename = this._extractLineFromFilename(file);
        if (!lineFromFilename) {
          console.error(`Could not extract line from filename: ${file}`);
          return;
        }
          
   //       console.log(file, lineFromFilename) 
        
        // Store with line-specific key (from filename)
        const lineSpecificKey = this._normalizeName(`${data.station}_${lineFromFilename}`);
          
          //console.log(lineSpecificKey) 
        this._lineSpecificAccessCache[lineSpecificKey] = data;
        
        // Also store under base name for backward compatibility
        const baseKey = this._normalizeName(data.station);
        this._accessDetailsCache[baseKey] = data;
      } catch (error) {
        console.error(`Error loading access file ${file}:`, error);
      }
    }));
  } catch (error) {
    console.error('Error accessing accessDetails directory:', error);
    throw error;
  }
},


    _extractLineFromFilename(filename) {
  // First try standard pattern access_station-line.json
  const standardMatch = filename.match(/access_(.*?)-?l?([1-6a]+)\.json$/i);
  if (standardMatch && standardMatch[2]) {
    return `l${standardMatch[2].toLowerCase()}`;
  }
  
  // Then try pattern with underscore access_station_line.json
  const underscoreMatch = filename.match(/access_(.*?)_([1-6a]+)\.json$/i);
  if (underscoreMatch && underscoreMatch[2]) {
    return `l${underscoreMatch[2].toLowerCase()}`;
  }
  
  // Finally try to extract any numbers at the end
  const endNumberMatch = filename.match(/access_(.*?)(\d+)\.json$/i);
  if (endNumberMatch && endNumberMatch[2]) {
    return `l${endNumberMatch[2].toLowerCase()}`;
  }
  
  console.warn(`Could not determine line from filename: ${filename}`);
  return null;
},
  
    _getAccessDetailsForStation(rawName, lineId) {
  // First try exact line-specific match
  if (lineId) {
    const lineSpecificKey = this._normalizeName(`${rawName}_${lineId}`);
    if (this._lineSpecificAccessCache[lineSpecificKey]) {
      return this._lineSpecificAccessCache[lineSpecificKey];
    }
    
    // Try without the rawName's existing line suffix if present
    const baseName = rawName.replace(/\s*(l[1-6]|l4a)$/i, '').trim();
    const altLineSpecificKey = this._normalizeName(`${baseName}_${lineId}`);
    if (this._lineSpecificAccessCache[altLineSpecificKey]) {
      return this._lineSpecificAccessCache[altLineSpecificKey];
    }
  }
  
  // Fall back to base name matches
  const nameVariations = this._getNameVariations(rawName);
  for (const variation of nameVariations) {
    if (this._accessDetailsCache[variation]) {
      return this._accessDetailsCache[variation];
    }
  }
  
  // Try to match by removing line suffixes and special characters
  const cleanName = this._normalizeName(rawName.replace(/\s*(l[1-6]|l4a)$/i, ''));
  if (this._accessDetailsCache[cleanName]) {
    return this._accessDetailsCache[cleanName];
  }
  
  return null;
}, 
    
  _transform(rawStations, rawConnections, rawData) {
    const canonicalStations = this._createCanonicalIndex();
    const result = {};

    // Process template stations first
    for (const [canonicalId, stationInfo] of Object.entries(canonicalStations)) {
      result[canonicalId] = {
        ...stationInfo,
        connections: this._getCanonicalConnections(canonicalId, stationInfo.line, rawConnections),
        _source: 'template'
      };
    }

    // Process line stations
    for (const [lineId, lineStations] of Object.entries(rawStations)) {
      for (const [rawName, stationData] of Object.entries(lineStations)) {
        const canonicalId = this._findCanonicalId(rawName, lineId, canonicalStations) || 
                          this._createCanonicalId(rawName, lineId);
        
        if (!result[canonicalId]) {
          result[canonicalId] = this._createBasicStation(canonicalId, lineId);
        }

        result[canonicalId] = {
          ...result[canonicalId],
          ...stationData,
          _source: result[canonicalId]._source ? 
                  `${result[canonicalId]._source}+stations` : 'stations'
        };
      }
    }

    // Process stations data
    if (rawData?.stationsData) {
      for (const [rawName, stationData] of Object.entries(rawData.stationsData)) {
        const lineMatch = rawName.match(/(l[1-6]|l4a)$/i);
        const lineId = lineMatch ? lineMatch[0].toLowerCase() : null;
        const canonicalId = this._findCanonicalId(rawName, lineId, canonicalStations) || 
                          this._createCanonicalId(rawName, lineId || 'unknown');
          
        if (!result[canonicalId]) {
          result[canonicalId] = this._createBasicStation(canonicalId, lineId || 'unknown');
        }

        const accessDetails = this._getAccessDetailsForStation(rawName, lineId);
          
          //console.log(rawName) 
          
          //console.log(accessDetails) 
        
        result[canonicalId] = {
          ...result[canonicalId],
          transports: stationData[0].replace(/\\n/g, "\n") || result[canonicalId].transports || 'None',
          services: stationData[1].replace(/\\n/g, "\n") || result[canonicalId].services || 'None',
          accessibility: stationData[2].replace(/\\n/g, "\n") || result[canonicalId].accessibility || 'None',
          accessDetails: accessDetails || null,
          commerce: stationData[3].replace(/\\n/g, "\n") || result[canonicalId].commerce || 'None',
          amenities: stationData[4].replace(/\\n/g, "\n") || result[canonicalId].amenities || 'None',
          image: stationData[5] || result[canonicalId].image || 'None',
          commune: stationData[6] || result[canonicalId].commune || 'None',
          _source: result[canonicalId]._source ? 
                  `${result[canonicalId]._source}+data` : 'data'
        };
      }
    }

    // Process schematics
    if (rawData?.stationsSchematics) {
      for (const [rawName, schematics] of Object.entries(rawData.stationsSchematics)) {
        const lineMatch = rawName.match(/(l[1-6]|l4a)$/i);
        const lineId = lineMatch ? lineMatch[0].toLowerCase() : null;
        const canonicalId = this._findCanonicalId(rawName, lineId, canonicalStations) || 
                          this._createCanonicalId(rawName, lineId || 'unknown');
        
        if (result[canonicalId]) {
          result[canonicalId].schematics = schematics;
        }
      }
    }

    return result;
  },

    _getNameVariations(rawName) {
  const normalized = this._normalizeName(rawName);
  const variations = new Set([normalized]);
  
  // Add version without line suffix
  const withoutLineSuffix = normalized.replace(/_l[1-6a]+$/, '');
  if (withoutLineSuffix !== normalized) {
    variations.add(withoutLineSuffix);
  }
  
  // Add version with hyphens instead of underscores
  variations.add(normalized.replace(/_/g, '-'));
  
  // Add version with spaces instead of underscores
  variations.add(normalized.replace(/_/g, ' '));
  
  return Array.from(variations);
}, 

  _normalizeName(name) {
    return name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/(^|_)(l[1-6]|l4a)$/, (match, p1, p2) => `_${p2}`);
  },

  _createCanonicalIndex() {
    const index = {};
    for (const [lineId, lineData] of Object.entries(estadoRedTemplate)) {
      for (const station of lineData.estaciones) {
        const canonicalId = station.nombre;
        index[canonicalId] = {
          id: canonicalId,
          line: lineId.toLowerCase(),
          displayName: station.nombre,
          code: station.codigo,
          status: {
              code: station.estado, 
              message: station.descripcion,
              appMessage: station.descripcion_app
             },
          color: styles.lineColors[lineId] || config.defaultLineColor,
          combination: station.combinacion || null
        };
      }
    }
    return index;
  },

  _findCanonicalId(rawName, lineId, canonicalStations) {
    if (canonicalStations[rawName]) return rawName;
    
    if (lineId) {
      const withSuffix = `${rawName} ${lineId.toUpperCase()}`;
      if (canonicalStations[withSuffix]) return withSuffix;
    }
    
    const normalizedRaw = this._normalizeName(rawName);
    for (const canonicalId in canonicalStations) {
      if (this._normalizeName(canonicalId) === normalizedRaw) {
        return canonicalId;
      }
    }
    
    return null;
  },

  _createCanonicalId(rawName, lineId) {
    return lineId && lineId !== 'unknown' ? 
      `${rawName} ${lineId.toUpperCase()}` : rawName;
  },

  _createBasicStation(canonicalId, lineId) {
    return {
      id: canonicalId,
      line: lineId.toLowerCase(),
      displayName: canonicalId,
      status: {message:'operational'},
      color: styles.lineColors[lineId] || config.defaultLineColor,
      connections: { transports: [], bikes: [] }
    };
  },

  _getCanonicalConnections(canonicalId, lineId, connectionsData) {
    const lineConnections = connectionsData[lineId]?.estaciones || [];
    
    const exactMatch = lineConnections.find(s => 
      s.nombre === canonicalId
    );
    if (exactMatch) {
      return {
        transports: exactMatch.conexiones || [],
        bikes: exactMatch.bici || []
      };
    }
    
    const normalizedCanonical = this._normalizeName(canonicalId);
    const normalizedMatch = lineConnections.find(s => 
      this._normalizeName(s.nombre) === normalizedCanonical
    );
    
    return normalizedMatch ? {
      transports: normalizedMatch.conexiones || [],
      bikes: normalizedMatch.bici || []
    } : { transports: [], bikes: [] };
  },

  async _loadFile(filename) {
    try {
      const data = await fs.readFile(path.join(__dirname, '../json', filename), 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error loading file ${filename}:`, error);
      throw error;
    }
  }
};
