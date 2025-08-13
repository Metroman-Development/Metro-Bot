// modules/metro/data/MigrationManager.js
// modules/metro/data/migrations/v2-service-enhancements.js
// modules/metro/data/MigrationManager.js
// modules/metro/data/MigrationManager.js
const fs = require('fs').promises;
const path = require('path');
const MetroDataFramework = require('./framework/MetroDataFramework');

class MetroDataMigration {
  constructor() {
    this.dataFramework = new MetroDataFramework({
      basePath: './metro-data/stations',
      autoGenerate: false
    });
    this.legacyDataPath = path.join(__dirname, './json');
    this.templatePath = path.join(__dirname, './templates');
    
    this.logger = {
      log: (message) => console.log(`[MIGRATION LOG] ${new Date().toISOString()} - ${message}`),
      error: (message) => console.error(`[MIGRATION ERROR] ${new Date().toISOString()} - ${message}`),
      warn: (message) => console.warn(`[MIGRATION WARNING] ${new Date().toISOString()} - ${message}`)
    };

    // Initialize line colors
    this.lineColors = {
      l1: '#e2001a', l2: '#f8b61c', l3: '#8cc63f',
      l4: '#00a1e4', l4a: '#00a1e4', l5: '#a05eb5',
      l6: '#d85e27'
    };
  }

  async migrateAllData() {
    this.logger.log('Starting complete data migration');
    
    try {
      // Load all data sources
      const [stationsData, connectionsData, templateData] = await Promise.all([
        this._loadLegacyData('stationsData.json'),
        this._loadLegacyData('stationConnections.json'),
        this._loadTemplateData()
      ]);

      // Initialize network
      await this.dataFramework.loadNetwork();

      // Process all stations
      const allStations = this._consolidateStationData(
        stationsData,
        connectionsData,
        templateData
      );

      // Migrate each station
      let successCount = 0;
      const totalStations = Object.keys(allStations).length;
      
      for (const [stationId, stationData] of Object.entries(allStations)) {
        try {
          this.logger.log(`Processing station ${stationId}`);
          const transformedData = this.transformStationData(stationId, stationData);
          await this.dataFramework.updateStation(
            stationData.lineId,
            stationId,
            transformedData
          );
          successCount++;
        } catch (error) {
          this.logger.error(`Failed to migrate station ${stationId}: ${error.message}`);
        }
      }

      this.logger.log(`Migration completed: ${successCount}/${totalStations} stations succeeded`);
      return { successCount, totalStations };
    } catch (error) {
      this.logger.error(`Migration failed: ${error.message}`);
      throw error;
    }
  }

  async _loadLegacyData(filename) {
    const filePath = path.join(this.legacyDataPath, filename);
    try {
      const data = await fs.readFile(filePath, 'utf8');
      this.logger.log(`Successfully loaded ${filename}`);
      return JSON.parse(data);
    } catch (error) {
      this.logger.error(`Failed to load ${filename}: ${error.message}`);
      throw error;
    }
  }

  async _loadTemplateData() {
    const templatePath = path.join(this.templatePath, 'estadoRedDetalle.php.json');
    try {
      const data = await fs.readFile(templatePath, 'utf8');
      this.logger.log('Loaded template data successfully');
      return JSON.parse(data);
    } catch (error) {
      this.logger.error(`Failed to load template: ${error.message}`);
      throw error;
    }
  }

  _consolidateStationData(stationsData, connectionsData, templateData) {
    const allStations = {};
    let templateCount = 0, stationsCount = 0, connectionsCount = 0;

    // 1. Process template data first (most authoritative)
    for (const [lineId, lineData] of Object.entries(templateData)) {
      for (const station of lineData.estaciones) {
        const normalizedId = this.normalizeStationId(station.nombre);
        allStations[normalizedId] = {
          id: normalizedId,
          lineId: lineId.toLowerCase(),
          displayName: station.nombre,
          code: station.codigo,
          status: {
            code: station.estado,
            description: station.descripcion,
            appMessage: station.descripcion_app
          },
          combination: station.combinacion || [],
          _source: ['template']
        };
        templateCount++;
      }
    }

    // 2. Process stations.json data
    for (const [lineId, lineStations] of Object.entries(stationsData.stations || {})) {
      for (const [rawName, stationData] of Object.entries(lineStations)) {
        const normalizedId = this.normalizeStationId(rawName);
        if (!allStations[normalizedId]) {
          allStations[normalizedId] = this._createBasicStation(normalizedId, lineId);
        }
        allStations[normalizedId] = {
          ...allStations[normalizedId],
          ...stationData,
          _source: [...allStations[normalizedId]._source, 'stations']
        };
        stationsCount++;
      }
    }

    // 3. Process connections
    for (const [lineId, lineConnections] of Object.entries(connectionsData)) {
      for (const station of lineConnections.estaciones || []) {
        const normalizedId = this.normalizeStationId(station.nombre);
        if (!allStations[normalizedId]) {
          allStations[normalizedId] = this._createBasicStation(normalizedId, lineId);
        }
        allStations[normalizedId].connections = {
          transports: station.conexiones || [],
          bikes: station.bici || []
        };
        connectionsCount++;
      }
    }

    this.logger.log(`Consolidated ${templateCount} template, ${stationsCount} stations, and ${connectionsCount} connection records`);
    return allStations;
  }

  transformStationData(stationId, legacyData) {
    try {
      const lineId = legacyData.lineId || 'l1';
      
      return {
        _meta: {
          version: 2,
          migratedAt: new Date().toISOString(),
          source: legacyData._source || 'legacy-v1'
        },
        basicInfo: {
          id: stationId,
          lineId,
          name: legacyData.displayName || this.extractStationName(stationId),
          code: legacyData.code || this._generateFallbackCode(stationId),
          displayName: legacyData.displayName || this.extractStationName(stationId),
          color: this.getLineColor(lineId)
        },
        status: {
          code: legacyData.status?.code || '0',
          description: legacyData.status?.description || '',
          appMessage: legacyData.status?.appMessage || '',
          combination: legacyData.combination || []
        },
        services: this.parseEnhancedServices(legacyData),
        access: {
          points: this.parseAccessPoints(legacyData.accessibility),
          accessibility: this.parseAccessibility(legacyData.accessibility)
        },
        connections: {
          transports: this.parseTransports(legacyData.connections?.transports || legacyData.transports),
          bikes: legacyData.connections?.bikes || []
        },
        amenities: this.parseAmenities(legacyData.amenities),
        commerce: this.parseCommerce(legacyData.commerce),
        commune: legacyData.commune !== 'None' ? legacyData.commune : null,
        schematics: legacyData.schematics || [],
        images: Array.isArray(legacyData.image) ? 
          legacyData.image.filter(img => img && img !== 'None') : 
          (legacyData.image && legacyData.image !== 'None' ? [legacyData.image] : [])
      };
    } catch (error) {
      this.logger.error(`Transformation failed for ${stationId}: ${error.message}`);
      throw error;
    }
  }

  normalizeStationId(id) {
    return id
      .replace(/(l[1-6]|l4a)$/i, '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  }

  extractStationName(stationId) {
    return stationId
      .replace(/(l[1-6]|l4a)$/i, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  _generateFallbackCode(stationId) {
    return this.normalizeStationId(stationId)
      .substring(0, 3)
      .toUpperCase();
  }

  getLineColor(lineId) {
    return this.lineColors[lineId.toLowerCase()] || '#cccccc';
  }

  parseEnhancedServices(legacyData) {
    const servicesString = legacyData.services || '';
    const commerceString = legacyData.commerce || '';
    
    return {
      tickets: {
        selfService: servicesString.includes('Máquinas de carga autoservicio'),
        atm: servicesString.includes('Redbanc'),
        phones: servicesString.includes('Teléfonos'),
        bibliometro: servicesString.includes('Bibliometro'),
        clientService: servicesString.includes('Oficina de Atención a Clientes'),
        vendingMachines: servicesString.includes('Máquinas de Vending') || 
                         commerceString.includes('Máquinas de Vending')
      },
      topUp: {
        bipPoints: servicesString.includes('Máquinas de carga autoservicio'),
        mobileTopUp: servicesString.includes('Puntos de recarga móvil')
      },
      info: {
        metroArte: legacyData.amenities?.includes('MetroArte') || false,
        metroInforma: legacyData.amenities?.includes('Metroinforma') || false
      }
    };
  }

  parseAccessPoints(accessData) {
    if (!accessData || accessData === 'None') return [];
    
    const accessString = Array.isArray(accessData) ? accessData.join(', ') : accessData.toString();
    const points = [];

    // Extract elevators
    const elevators = accessString.match(/Ascensor[^.,]*/g) || [];
    elevators.forEach(elev => {
      points.push({
        type: 'elevator',
        description: elev.trim(),
        status: 'operational'
      });
    });

    // Extract ramps
    const ramps = accessString.match(/Rampa[^.,]*/g) || [];
    ramps.forEach(ramp => {
      points.push({
        type: 'ramp',
        description: ramp.trim(),
        status: 'operational'
      });
    });

    return points;
  }

  parseAccessibility(accessData) {
    if (!accessData || accessData === 'None') return [];
    
    const accessString = Array.isArray(accessData) ? accessData.join(', ') : accessData.toString();
    const features = [];
    
    if (accessString.includes('Ascensor')) features.push('elevator');
    if (accessString.includes('Rampa')) features.push('ramp');
    if (accessString.includes('Acceso universal')) features.push('universal_access');
    
    return features;
  }

  parseTransports(transportData) {
    if (!transportData || transportData === 'None') return [];
    
    const transportString = Array.isArray(transportData) ? transportData.join(', ') : transportData.toString();
    const transports = [];
    
    if (transportString.includes('Buses')) transports.push('bus');
    if (transportString.includes('Tren')) transports.push('train');
    if (transportString.includes('Aeropuerto')) transports.push('airport_shuttle');
    if (transportString.includes('Intermodales')) transports.push('intermodal');
    
    return transports;
  }

  parseAmenities(amenitiesData) {
    if (!amenitiesData || amenitiesData === 'None') return [];
    
    const amenitiesString = Array.isArray(amenitiesData) ? amenitiesData.join(', ') : amenitiesData.toString();
    const amenities = [];
    
    if (amenitiesString.includes('Bibliometro')) amenities.push('library');
    if (amenitiesString.includes('MetroArte')) amenities.push('art');
    if (amenitiesString.includes('Metroinforma')) amenities.push('information');
    
    return amenities;
  }

  parseCommerce(commerceData) {
    if (!commerceData || commerceData === 'None') return [];
    
    if (Array.isArray(commerceData)) {
      return commerceData
        .flatMap(item => typeof item === 'string' ? item.split(',').map(i => i.trim()) : [])
        .filter(item => item && item !== 'None');
    }
    
    return commerceData.split(',')
      .map(item => item.trim())
      .filter(item => item && item !== 'None');
  }

  _createBasicStation(stationId, lineId) {
    return {
      id: stationId,
      lineId: lineId.toLowerCase(),
      displayName: stationId.replace(/_/g, ' '),
      status: { code: '0', description: 'operational' },
      connections: { transports: [], bikes: [] },
      _source: []
    };
  }
}

module.exports = MetroDataMigration;