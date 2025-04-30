const logger = require('../events/logger');

// Real operation state
let currentChanges = [];
let currentSummary = {
    hasEstado0: false,
    messages: {},
    networkStatus: 1
};
let previousSummary = null;

// Test mode control
let testMode = {
    active: false,
    data: null
};

/**
 * Determines overall network status from line and station estados
 */
function determineNetworkStatus(lineEstados, stationEstados) {
    const allEstados = [...lineEstados, ...stationEstados];
    
    // Status priority: 0 > 5 > 2 > 3 > 4 > 1
    if (allEstados.every(e => e === 0)) return 0;       // Fully closed
    if (allEstados.some(e => e === 5)) return 5;        // Extended service
    if (allEstados.some(e => e === 2)) return 2;        // Stations closed
    if (allEstados.some(e => e === 3)) return 3;        // Partial service
    if (allEstados.some(e => e === 4)) return 4;        // Delays
    return 1;                                           // Normal
}

/**
 * Compares two summaries to detect changes
 */
function compareSummaries(oldSummary, newSummary) {
    const changes = [];
    
    // Check for resolved incidents
    Object.keys(oldSummary.messages).forEach(message => {
        if (!newSummary.messages[message]) {
            changes.push({
                type: 'resolved',
                message: message,
                previousState: oldSummary.messages[message]
            });
            logger.info(`Incidente resuelto: ${message}`);
        }
    });

    // Check for new or modified incidents
    Object.keys(newSummary.messages).forEach(message => {
        const oldMsg = oldSummary.messages[message];
        const newMsg = newSummary.messages[message];
        
        if (!oldMsg) {
            changes.push({
                type: 'new',
                message: message,
                newState: newMsg
            });
            logger.info(`Nuevo incidente: ${message}`);
        } else {
            // Compare line states
            const lineChanges = [];
            
            // Check removed lines
            oldMsg.lines.forEach(oldLine => {
                if (!newMsg.lines.some(l => l.line === oldLine.line)) {
                    lineChanges.push({
                        type: 'removed',
                        line: oldLine.line,
                        previousEstado: oldLine.estado
                    });
                }
            });

            // Check new/changed lines
            newMsg.lines.forEach(newLine => {
                const oldLine = oldMsg.lines.find(l => l.line === newLine.line);
                if (!oldLine) {
                    lineChanges.push({
                        type: 'added',
                        line: newLine.line,
                        newEstado: newLine.estado
                    });
                } else if (oldLine.estado !== newLine.estado) {
                    lineChanges.push({
                        type: 'changed',
                        line: newLine.line,
                        previousEstado: oldLine.estado,
                        newEstado: newLine.estado
                    });
                }
            });

            // Compare station states
            const stationChanges = [];
            Object.keys(oldMsg.stations || {}).forEach(line => {
                (oldMsg.stations[line] || []).forEach(station => {
                    if (!newMsg.stations[line]?.includes(station)) {
                        stationChanges.push({
                            type: 'removed',
                            line: line,
                            station: station
                        });
                    }
                });
            });

            Object.keys(newMsg.stations || {}).forEach(line => {
                (newMsg.stations[line] || []).forEach(station => {
                    if (!oldMsg.stations[line]?.includes(station)) {
                        stationChanges.push({
                            type: 'added',
                            line: line,
                            station: station
                        });
                    }
                });
            });

            if (lineChanges.length > 0 || stationChanges.length > 0) {
                changes.push({
                    type: 'modified',
                    message: message,
                    lineChanges: lineChanges,
                    stationChanges: stationChanges
                });
            }
        }
    });

    return changes;
}

module.exports = {
    /**
     * Detects changes between old and new metro data
     */
    detectChanges: (newData, oldData) => {
        
        console.log(currentSummary);
        
        if (testMode.active) return true;

        const newSummary = {
            hasEstado0: false,
            messages: {},
            networkStatus: 1
        };
        const lineEstados = [];
        const stationEstados = [];
        currentChanges = [];

        // Build new status summary
        Object.entries(newData).forEach(([lineKey, line]) => {
            const lineEstado = parseInt(line.estado);
            lineEstados.push(lineEstado);
            if (lineEstado === 0) newSummary.hasEstado0 = true;

            // Process line-level incidents
            if (lineEstado >= 2) {
                const msgKey = line.mensaje_app?.trim() || `Línea ${lineKey} - Sin mensaje`;
                newSummary.messages[msgKey] = newSummary.messages[msgKey] || { 
                    lines: [], 
                    stations: {} 
                };
                newSummary.messages[msgKey].lines.push({
                    line: lineKey,
                    estado: lineEstado
                });
            }

            // Process station-level incidents
            (line.estaciones || []).forEach(station => {
                const stationEstado = parseInt(station.estado);
                stationEstados.push(stationEstado);
                if (stationEstado === 0) newSummary.hasEstado0 = true;

                if (stationEstado >= 2) {
                    const msgKey = station.descripcion_app?.trim() || `Estación ${station.nombre} - Sin descripción`;
                    newSummary.messages[msgKey] = newSummary.messages[msgKey] || { 
                        lines: [], 
                        stations: {} 
                    };
                    newSummary.messages[msgKey].stations[lineKey] = [
                        ...(newSummary.messages[msgKey].stations[lineKey] || []),
                        station.nombre
                    ];
                }
            });
        });

        // Determine overall network status
        newSummary.networkStatus = determineNetworkStatus(lineEstados, stationEstados);

        // Compare with previous state if available
        if (previousSummary) {
            currentChanges = compareSummaries(previousSummary, newSummary);
        }

        // Update state tracking
        previousSummary = structuredClone(newSummary);
        currentSummary = newSummary;

        return currentChanges.length > 0;
    },

    // Status accessors
    getNetworkStatus: () => testMode.active ? testMode.data.networkStatus : currentSummary.networkStatus,
    getStatusSummary: () => testMode.active ? testMode.data : currentSummary,
    getCurrentChanges: () => currentChanges,

    // Test mode control
    enableTestMode: (testData) => {
        testMode = {
            active: true,
            data: {
                hasEstado0: testData.hasEstado0 || false,
                messages: testData.messages || {},
                networkStatus: testData.networkStatus || 1
            }
        };
        logger.info('Test mode activated');
    },
    
    disableTestMode: () => {
        testMode = { active: false, data: null };
        logger.info('Test mode deactivated');
    },

    // For debugging
    _getInternalState: () => ({
        previousSummary,
        currentSummary,
        testMode
    })
};
