// config/metro/statusConfig.js
module.exports = {
  lineWeights: {
    'l1': 7,  // heaviest
    'l5': 6,
    'l4': 5,
    'l2': 4,
    'l3': 3,
    'l6': 2,
    'l4a': 1  // lightest
  },

  statusMap: {
    '0': { es: 'fuera de horario', en: 'off-hours', severity: 0, lineSeverityImpact: 0, networkScale: 0 },
    '1': { es: 'abierta', en: 'open', severity: 1, lineSeverityImpact: 0, networkScale: 1 },
    '2': { es: 'combinación', en: 'transfer', severity: 1, lineSeverityImpact: 0, networkScale: 1 },
    '3': { es: 'accesos controlados', en: 'controlled access', severity: 2, lineSeverityImpact: 2, networkScale: 4 },
    '4': { es: 'accesos parciales', en: 'partial access', severity: 2, lineSeverityImpact: 2, networkScale: 4 },
    '5': { es: 'cerrada', en: 'closed', severity: 4, lineSeverityImpact: 4, networkScale: 8 },
    '7': { es: 'contención', en: 'containment', severity: 3, lineSeverityImpact: 3, networkScale: 5 },
    '8': { es: 'servicio extendido solo entrada', en: 'extended service (entry only)', severity: 2, lineSeverityImpact: 0, networkScale: 2 },
    '9': { es: 'servicio extendido solo salida', en: 'extended service (exit only)', severity: 2, lineSeverityImpact: 0, networkScale: 2 },
    '10': { es: 'operativa', en: 'operational', severity: 1, lineSeverityImpact: 0, networkScale: 1 },
    '11': { es: 'lenta', en: 'slow', severity: 2, lineSeverityImpact: 2, networkScale: 3 },
    '12': { es: 'retrasos', en: 'delays', severity: 3, lineSeverityImpact: 3, networkScale: 6 },
    '13': { es: 'parcial', en: 'partial', severity: 3, lineSeverityImpact: 4, networkScale: 7 },
    '14': { es: 'suspendida', en: 'suspended', severity: 5, lineSeverityImpact: 5, networkScale: 10 },
    '15': { es: 'fuera de servicio', en: 'off-service', severity: 0, lineSeverityImpact: 0, networkScale: 0 },
    '16': { es: 'operativo', en: 'operational', severity: 0, lineSeverityImpact: 0, networkScale: 1 },
    '17': { es: 'con demoras', en: 'with delays', severity: 4, lineSeverityImpact: 3, networkScale: 6 },
    '18': { es: 'servicio parcial', en: 'partial service', severity: 3, lineSeverityImpact: 2, networkScale: 7 },
    '19': { es: 'suspendido', en: 'suspended', severity: 1, lineSeverityImpact: 1, networkScale: 10 },
    '20': { es: 'servicio extendido', en: 'extended service', severity: 0, lineSeverityImpact: 0, networkScale: 2 }
  },

  severityLabels: {
    es: [
      { threshold: 0, label: 'Normal' },
      { threshold: 50, label: 'Baja' },
      { threshold: 100, label: 'Moderada' },
      { threshold: 150, label: 'Alta' },
      { threshold: 200, label: 'Muy Alta' },
      { threshold: 300, label: 'Crítica' }
    ],
    en: [
      { threshold: 0, label: 'Normal' },
      { threshold: 50, label: 'Low' },
      { threshold: 100, label: 'Moderate' },
      { threshold: 150, label: 'High' },
      { threshold: 200, label: 'Very High' },
      { threshold: 300, label: 'Critical' }
    ]
  }
};