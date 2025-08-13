// modules/templates/defaultStatusStrings.js
module.exports = {
    STATUS_TYPES: {
        OPERATIONAL: {
            key: 'operational',
            emoji: '✅',
            display: 'Operativa',
            color: '#2ecc71',
            description: 'Servicio normal en toda la red'
        },
        DELAYED: {
            key: 'delayed',
            emoji: '⚠️',
            display: 'Retrasos',
            color: '#e67e22',
            description: 'Demoras en algunos servicios'
        },
        PARTIAL_OUTAGE: {
            key: 'partial_outage',
            emoji: '🔧',
            display: 'Servicio Parcial',
            color: '#f39c12',
            description: 'Interrupciones parciales en {lines}'
        },
        MAJOR_OUTAGE: {
            key: 'major_outage',
            emoji: '🚧',
            display: 'Interrupción Mayor',
            color: '#e74c3c',
            description: 'Interrupciones significativas en {lines}'
        },
        CLOSED: {
            key: 'closed',
            emoji: '⛔',
            display: 'Cerrada',
            color: '#95a5a6',
            description: 'Servicio no disponible'
        },
        EXTENDED: {
            key: 'extended',
            emoji: '⏱️',
            display: 'Horario Extendido',
            color: '#4CAF50',
            description: 'Horario especial hasta {time}'
        },
        UNKNOWN: {
            key: 'unknown',
            emoji: '❓',
            display: 'Estado Desconocido',
            color: '#666666',
            description: 'Estado del servicio no disponible'
        }
    },

    TEMPLATE_STRINGS: {
        HEADERS: {
            NETWORK_STATUS: '🚇 Estado de la Red Metro',
            LINE_STATUS: '🚈 Estado de Línea',
            STATIONS: '🏷️ Estaciones',
            OPERATING_HOURS: '🕒 Horario',
            RECENT_CHANGES: '🔄 Cambios Recientes', 
            ERROR:"❌ Ha ocurrido un Problema con la Solicitud", 
            
            EVENT:"🎉Evento del Día", 
        },
        
        DESCRIPTIONS: {
            DEFAULT_NETWORK: 'Servicio metro de Santiago',
            EVENT_ACTIVE: '**Evento especial en curso**\n{description}',
            MAINTENANCE: 'Trabajos de mantención en {locations}'
        },
        
        FOOTERS: {
            LAST_UPDATED: 'Actualizado: {datetime}',
            FARE_PERIOD: 'Período: {period} • Tarifa: {fare}',
            SERVICE_HOURS: 'Horario servicio: {opening} - {closing}'
        },
        
        MESSAGES: {
            NO_INFO: 'Información no disponible',
            MULTIPLE_AFFECTED: '{count} {type} afectados',
            SINGLE_AFFECTED: '1 {type} afectado',
            EXTENDED_HOURS: 'Horario extendido hasta {closing}'
        }
    },

    STATUS_PRIORITY: [
        'major_outage',
        'partial_outage',
        'closed',
        'delayed',
        'extended',
        'operational',
        'unknown'
    ],

    ICON_MAPPING: {
        line: '🚈',
        station: 'Ⓜ️',
        service: '⚙️',
        alert: '🚨',
        event: '📅'
    },

    getStatusTemplate(statusKey) {
        return this.STATUS_TYPES[statusKey.toUpperCase()] || this.STATUS_TYPES.UNKNOWN;
    },

    formatTemplateString(template, values) {
        return Object.entries(values).reduce((str, [key, value]) => {
            return str.replace(new RegExp(`{${key}}`, 'g'), value);
        }, template);
    },

    getAffectedMessage(count, type) {
        const template = count === 1 
            ? this.TEMPLATE_STRINGS.MESSAGES.SINGLE_AFFECTED
            : this.TEMPLATE_STRINGS.MESSAGES.MULTIPLE_AFFECTED;
            
        return this.formatTemplateString(template, {
            count,
            type: type === 'lines' ? 'líneas' : 'estaciones'
        });
    }
};