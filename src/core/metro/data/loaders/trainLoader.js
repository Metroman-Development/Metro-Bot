// trainLoader.js
const path = require('path');
const loadJsonFile = require('../../../../utils/jsonLoader.js');

module.exports = {
  source: 'trainInfo.json + trainImages.json',
  async load() {
    const [info, images] = await Promise.all([
      this._loadFile('trainInfo.json'),
      this._loadFile('trainImages.json')
    ]);
    return this._transform(info, images);
  },

  _loadFile(filename) {
    return loadJsonFile(path.join(__dirname, '..', filename));
  },

  _transform(info, images) {
    return Object.entries(info.modelos).reduce((acc, [id, data]) => {
      acc[id] = {
        id,
        generalInfo: this._extractGeneralInfo(data),
        technicalSpecs: this._extractTechnicalSpecs(data),
        dimensions: this._extractDimensions(data),
        weightData: this._extractWeightData(data),
        electricalSystems: this._extractElectricalSystems(data),
        operationalData: this._extractOperationalData(data),
        composition: this._extractComposition(data),
        safetyFeatures: this._extractSafetyFeatures(data),
        comfortFeatures: this._extractComfortFeatures(data),
        manufacturingData: this._extractManufacturingData(data),
        images: images[id] || {},
        metadata: {
          lastUpdated: new Date().toISOString(),
          dataSource: 'Metro de Santiago'
        }
      };
      return acc;
    }, {});
  },

  _extractGeneralInfo(data) {
    const general = data.datos_generales || {};
    return {
      manufacturer: general.fabricante,
      manufacturingYears: general.año_fabricacion,
      operator: general.operador,
      serviceType: general.servicios,
      registrationNumbers: general.matriculacion_nacional,
      modelFamily: general.familia || 'N/A',
      generation: general.generacion || 'N/A'
    };
  },

  _extractTechnicalSpecs(data) {
    const tech = data.caracteristicas_tecnicas || {};
    return {
      propulsionType: tech.tipo_traccion,
      trackGauge: tech.ancho_via,
      maxSpeed: tech.velocidad_maxima,
      axleArrangement: tech.disposicion_ejes,
      transmission: tech.transmision,
      brakingSystems: tech.frenos || [],
      minimumCurveRadius: tech.radio_minimo_curva || 'N/A',
      acceleration: tech.aceleracion || 'N/A',
      deceleration: tech.frenado || 'N/A'
    };
  },

  _extractDimensions(data) {
    const tech = data.caracteristicas_tecnicas || {};
    const dims = tech.dimensiones || {};
    return {
      length: dims.longitud,
      width: dims.anchura,
      height: dims.altura,
      doorWidth: dims.ancho_puertas || 'N/A',
      floorHeight: dims.altura_piso || 'N/A',
      gangwayWidth: dims.ancho_pasillo || 'N/A'
    };
  },

  _extractWeightData(data) {
    const tech = data.caracteristicas_tecnicas || {};
    return {
      emptyWeight: tech.peso,
      axleLoad: tech.carga_por_eje || 'N/A',
      maxPayload: tech.carga_util || 'N/A',
      weightDistribution: tech.distribucion_peso || 'N/A'
    };
  },

  _extractElectricalSystems(data) {
    const tech = data.caracteristicas_tecnicas || {};
    const motors = tech.motores_electricos || {};
    return {
      powerOutput: motors.potencia,
      voltage: motors.alimentacion,
      motorType: motors.tipo,
      motorCount: motors.numero,
      pantographs: tech.pantografos || 'N/A',
      energyRecovery: tech.frenos?.includes('Regenerativo') || false,
      auxiliarySystems: tech.sistemas_auxiliares || 'N/A'
    };
  },

  _extractOperationalData(data) {
    const general = data.datos_generales || {};
    const units = general.unidades_fabricadas || {};
    return {
      totalTrains: units.trenes,
      totalUnits: units.unidades,
      activeTrains: units.en_servicio?.trenes,
      activeUnits: units.en_servicio?.unidades,
      retirementYear: units.retiro || 'N/A',
      maintenanceCycle: units.ciclo_mantenimiento || 'N/A',
      meanDistanceBetweenFailures: units.mtbf || 'N/A'
    };
  },

  _extractComposition(data) {
    const tech = data.caracteristicas_tecnicas || {};
    return {
      configurations: tech.composicion,
      carTypes: this._extractCarTypes(tech.composicion),
      couplingSystem: tech.conexiones?.acoplamiento,
      multipleUnitControl: tech.conexiones?.mando_multiple || 'N/A',
      trainFormation: tech.formacion || 'N/A'
    };
  },

  _extractCarTypes(compositions) {
    if (!compositions) return [];
    const types = new Set();
    compositions.forEach(comp => {
      comp.split(':')[1]?.match(/[A-Z]+/g)?.forEach(type => types.add(type));
    });
    return Array.from(types);
  },

  _extractSafetyFeatures(data) {
    const tech = data.caracteristicas_tecnicas || {};
    return {
      protectionSystems: tech.equipamiento?.proteccion,
      fireDetection: tech.equipamiento?.deteccion_incendios || 'N/A',
      emergencyExits: tech.equipamiento?.salidas_emergencia || 'N/A',
      crashworthiness: tech.equipamiento?.resistencia_colision || 'N/A',
      surveillance: tech.equipamiento?.videovigilancia || 'N/A'
    };
  },

  _extractComfortFeatures(data) {
    const tech = data.caracteristicas_tecnicas || {};
    const perf = tech.prestaciones || {};
    return {
      seatingCapacity: perf.plazas_sentado || 'N/A',
      standingCapacity: perf.plazas,
      climateControl: perf.climatizacion || perf.ventilacion || 'N/A',
      wheelchairSpaces: perf.plazas_pmr || 'N/A',
      wifi: perf.wifi || false,
      usbPorts: perf.usb || false,
      passengerInformation: perf.informacion_pasajeros || 'N/A',
      lighting: perf.iluminacion || 'N/A'
    };
  },

  _extractManufacturingData(data) {
    const general = data.datos_generales || {};
    return {
      productionYears: general.año_fabricacion,
      constructionSites: general.lugares_construccion || 'N/A',
      prototypeYear: general.año_prototipo || 'N/A',
      designCompany: general.diseñador || 'N/A',
      productionCost: general.costo_produccion || 'N/A'
    };
  }
};