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
    '0': {
      en: 'off-hours',
      es: 'fuera de servicio',
      severity: 0,
      lineSeverityImpact: 0,
      networkScale: 0
    },
    '1': {
      en: 'operational',
      es: 'operativo',
      severity: 0,
      lineSeverityImpact: 0,
      networkScale: 1
    },
    '2': {
      en: 'delayed',
      es: 'con demoras',
      severity: 4,
      lineSeverityImpact: 3,
      networkScale: 6
    },
    '3': {
      en: 'partial',
      es: 'servicio parcial',
      severity: 3,
      lineSeverityImpact: 2,
      networkScale: 7
    },
    '4': {
      en: 'suspended',
      es: 'suspendido',
      severity: 1,
      lineSeverityImpact: 1,
      networkScale: 10
    },
    '5': {
      en: 'extended',
      es: 'servicio extendido',
      severity: 0,
      lineSeverityImpact: 0,
      networkScale: 2
    }
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
