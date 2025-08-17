// modules/metro/utils/stringHandlers/decorators.js
const config = require('../../../../config/metro/metroConfig');
const logger = require('../../../../events/logger');

// 1. HELPER FUNCTIONS (PRIVATE) =======================================

function getEnhancedStationData(station, metroCore) {
    let enhanced = {...station};
    
    if (metroCore?._staticData?.stations) {
        const staticStation = metroCore._staticData.stations[station.id] || 
            Object.values(metroCore._staticData.stations).find(s => 
                s.displayName?.toLowerCase() === (station.displayName || '').toLowerCase()
            );
        
        if (staticStation) {
            enhanced = {
                ...staticStation,
                ...station,
                id: station.id || staticStation.id
            };
        }
    }
    
    if (!enhanced.line) enhanced.line = 'unknown';
    if (!enhanced.displayName) enhanced.displayName = enhanced.name || enhanced.id;
    
    return enhanced;
}

function getStatusComponents(station, isTransfer) {
    const statusCode = station.status?.code || station.normalizedStatus || '1';
    return {
        emoji: config.statusTypes[statusCode]?.emoji || '🟩',
        isTransfer
    };
}

function getRouteEmoji(routeType) {
   
   // console.log("Hols ", routeType) 
    const routeKey = routeType.toLowerCase().replace("ruta ", "").replace("ú", "u");
    return config.routeStyles[routeKey]?.emoji || '';
}

function getLineEmoji(station, metroCore) {
    const lineKey = station.line.toLowerCase();
    return metroCore?.utils?.getLineEmoji?.(lineKey) || 
          config.linesEmojis[lineKey] || 
          '🚇';
}

/**
 * Gets status emoji for any metro entity
 * @param {string} statusCode - Status code (number or text)
 * @param {string} [severity='normal'] - Severity level
 * @returns {string} Appropriate emoji
 */
function getStatusEmoji(statusCode, severity = 'normal') {
    const statusMap = {
        // Numeric codes
        '0': '🟤', // Cierre por horario
        '1': '🟢', // Operativa
        '2': '🔴', // Cerrada
        '3': '🟠', // Cierre parcial
        '4': '🟡', // Demoras
        '5': '🔵', // Ruta extendida
        
        // Text codes
        operational: '🟢',
        closed: '🔴',
        partial_closure: '🟠',
        delayed: '🟡',
        major_outage: '💥',
        partial_outage: '⚠️',
        extended: '🔵',
        unknown: '⚫'
    };

    // Critical status override
    if (severity === 'critical') return '🚨';
    
    return statusMap[statusCode] || statusMap.unknown;
}

function cleanStationName(station) {
    return (station.displayName || station.name || station.id)
        .replace(/\s+L\d+[a-z]*$/i, '');
}

function checkIsTransfer(station, metroCore) {
    return (station.combination || 
           station.transferLines.length>0|| 
           (metroCore?.stations?.connections?.(station.id)?.length > 0));
}

function getConnectionEmojis(station) {
    if (!station.connections) return '';
    
    const emojis = [];
    const { transports = [], bikes = [] } = station.connections;
    
    transports.forEach(t => {
        if (config.connectionEmojis[t]) emojis.push(config.connectionEmojis[t]);
    });
    
    bikes.forEach(b => {
        if (config.connectionEmojis[b]) emojis.push(config.connectionEmojis[b]);
    });
    
    return emojis.join(' ');
}

function buildStationString(statusEmoji, routeEmoji, lineEmoji, name, transferEmoji, connections) {
    return [
        statusEmoji,
        routeEmoji,
        /*lineEmoji,*/
        name,
        transferEmoji,
        connections
    ].filter(Boolean).join(' '); // Safe length limit
}

// 2. PUBLIC EXPORTS ==================================================

module.exports = {
    /**
     * Main station decoration function
     * @param {object} station - Station data
     * @param {object} metroCore - MetroCore instance
     * @returns {string} Decorated station string
     */
    decorateStation: function(station, metroCore) {
        try {
            
         //   console.log("Mejorando Datos Estación") 
            
            const enhancedStation = getEnhancedStationData(station, metroCore);
            
            //console.log(enhancedStation) 
           
            //  console.log("Checkando Combinación");
           
            const isTransfer = checkIsTransfer(enhancedStation, metroCore);
            
        //    console.log("Checkando Estado") ;
            
            const status = getStatusComponents(enhancedStation, isTransfer);
            
            //console.log(status) ;
           
            const statusEmoji = status.emoji// + station.status.code
            
            return buildStationString(
                statusEmoji,
                enhancedStation.ruta ? getRouteEmoji(enhancedStation.ruta) : '',
                getLineEmoji(enhancedStation, metroCore),
                
                
                cleanStationName(enhancedStation),
                isTransfer ? config.linesEmojis[enhancedStation.line.toLowerCase()] + '↔️' + config.linesEmojis[enhancedStation.combination.toLowerCase()] : '',
                
                getConnectionEmojis(enhancedStation)
            );
        } catch (error) {
            console.error('Station decoration failed', {
                stationId: station?.id,
                error: error.message
            });
            return `❓ ${station.id || 'Unknown'}`;
        }
    },

    /**
     * Line decoration function
     * @param {string} lineId - Line identifier
     * @param {object} metroCore - MetroCore instance
     * @returns {string} Decorated line string
     */
    decorateLine: function(lineId, metroCore) {
        try {
            const lineKey = lineId.toLowerCase();
            const lineEmoji = metroCore?.utils?.getLineEmoji?.(lineKey) || 
                            config.linesEmojis[lineKey] || 
                            '🚇';
            return `${lineEmoji} Línea ${lineKey.toUpperCase().replace("l", "")}`;
        } catch (error) {
            logger.error('Line decoration failed', {
                lineId,
                error: error.message
            });
            return `🚇 Línea ${lineId.replace("l", "")}`;
        }
    }, 
    
    getStatusEmoji, 
};
