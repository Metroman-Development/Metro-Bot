const { translateApiData } = require('../../data/dataTranslator');

class DataProcessor {
    constructor(statusProcessor) {
        this.statusProcessor = statusProcessor;
    }

    processData(rawData, dataVersion) {
        const translatedData = translateApiData(rawData);
        return this.statusProcessor
            ? this.statusProcessor.processRawAPIData(translatedData)
            : this._basicProcessData(translatedData, dataVersion);
    }

    _basicProcessData(rawData, dataVersion) {
        const lines = Object.fromEntries(
            Object.entries(rawData.lineas || {})
                .filter(([k, lineData]) => k.toLowerCase().startsWith('l') && lineData.nombre)
                .map(([lineId, lineData]) => {
                    const lowerLineId = lineId.toLowerCase();
                    return [
                        lowerLineId,
                        {
                            id: lowerLineId,
                            displayName: lineData.nombre,
                            status: lineData.estado,
                            message: lineData.mensaje,
                            message_app: lineData.mensaje_app,
                            stations: lineData.estaciones?.filter(s => s.codigo && s.nombre).map(station => ({
                                id: station.codigo.toUpperCase(),
                                name: station.nombre,
                                status: station.estado,
                                description: station.descripcion,
                                description_app: station.descripcion_app,
                                transfer: station.combinacion || '',
                                ...(station.isTransferOperational !== undefined && {
                                    isTransferOperational: station.isTransferOperational
                                }),
                                ...(station.accessPointsOperational !== undefined && {
                                    accessPointsOperational: station.accessPointsOperational
                                })
                            })) || []
                        }
                    ];
                })
        );

        const networkStatus = this._generateNetworkStatus(lines);

        const processed = {
            lines,
            network: networkStatus,
            stations: {},
            version: dataVersion,
            lastUpdated: new Date().toISOString(),
            _metadata: {
                source: 'generated',
                timestamp: new Date(),
                generation: 'basic'
            }
        };

        processed.stations = Object.values(processed.lines)
            .flatMap(line => line.stations)
            .reduce((acc, station) => {
                acc[station.id] = station;
                return acc;
            }, {});

        return processed;
    }

    _generateNetworkStatus(lines) {
        if (!lines || Object.keys(lines).length === 0) {
            return { status: 'outage', lastUpdated: new Date().toISOString() };
        }

        const lineStatuses = Object.values(lines).map(line => line.status);
        const operationalLines = lineStatuses.filter(s => s === '1').length;
        const totalLines = lineStatuses.length;
        const degradedLines = totalLines - operationalLines;

        let overallStatus = 'operational';
        if (degradedLines > 0 && operationalLines === 0) {
            overallStatus = 'outage';
        } else if (degradedLines > 0) {
            overallStatus = 'degraded';
        }

        return {
            status: overallStatus,
            lastUpdated: new Date().toISOString()
        };
    }
}

module.exports = DataProcessor;
