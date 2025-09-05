// File: RoutePlanner.js
const logger = require('../../events/logger');


class RoutePlanner {
    static async getRoutes(startCode, endCode, farePeriod) {
        try {
            // Validate inputs - original validation kept intact
            if (!startCode || !endCode || !farePeriod) {
                throw new Error('Missing required parameters: startCode, endCode, or farePeriod');
            }

            // Build URL using environment variables - original logic preserved
            const baseUrl = process.env.METRO_API_BASE_URL;
            const apiPath = process.env.METRO_API_PATH;

            const apiUrl = `${baseUrl}${apiPath}?estacionInicio=${startCode.toUpperCase()}&estacionFin=${endCode.toUpperCase()}&dia=dl&hora=${farePeriod.toUpperCase()}`;
            
            // Original logging kept but sanitized
            logger.debug(`Fetching routes from Metro API [${startCode.toUpperCase()}→${endCode.toUpperCase()}]`);
            
            // Original fetch implementation
            const response = await fetch(apiUrl);
            
            // Original response handling
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Original response validation
            if (data.estado !== 1) {
                logger.warn(`API returned non-success state: ${data.mensaje || 'Unknown error'}`);
                return null;
            }

            if (!data.rutas || !Array.isArray(data.rutas) || data.rutas.length === 0) {
                logger.info('No routes found in response');
                return null;
            }

            // Original processing
            return this._processRoutes(data.rutas, farePeriod);
        } catch (error) {
            // Original error handling
            logger.error(`RoutePlanner Error: ${error.message}`, { 
                error: error.stack,
                params: { startCode, endCode, farePeriod }
            });
            return null;
        }
    }

    // COMPLETE original _processRoutes implementation
    static _processRoutes(routes, farePeriod) {
        return routes
            .filter(route => route.tramos && Array.isArray(route.tramos) && route.tramos.length > 0)
            .sort((a, b) => (a.tiempo || Infinity) - (b.tiempo || Infinity))
            .map(route => ({
                id: this._generateRouteId(route),
                totalTime: route.tiempo || 0,
                stationCount: route.estaciones || 0,
                segments: this._processSegments(route.tramos, farePeriod),
                transferCount: route.tramos.filter(t => 
                    ['combinacion', 'cambio'].includes(t.tipo)
                ).length,
                farePeriod: farePeriod,
                rawData: route
            }));
    }

    // COMPLETE original _processSegments implementation
    static _processSegments(tramos, farePeriod) {
        return tramos.map((tramo, index) => {
            const baseSegment = {
                type: tramo.tipo || 'unknown',
                duration: this._parseDuration(tramo.tiempo),
                direction: tramo.direccion || 'Unknown direction',
                farePeriod: farePeriod
            };

            // Original transfer handling
            if (tramo.tipo === 'combinacion' || tramo.tipo === 'cambio') {
                let transferStation = null;
                let nextDirection = null;
                
                if (index > 0 && tramos[index - 1].fin) {
                    transferStation = this._processStation(tramos[index - 1].fin);
                } 
                else if (index < tramos.length - 1 && tramos[index + 1].inicio) {
                    transferStation = this._processStation(tramos[index + 1].inicio);
                }
                else {
                    transferStation = {
                        code: 'UNKN',
                        name: tramo.direccion || 'Unknown transfer station',
                        line: tramo.linea?.toUpperCase() || 'UNKNOWN',
                        accessibility: null
                    };
                }
                
                const nextTramo = tramos[index + 1];
                if (nextTramo?.direccion) {
                    nextDirection = nextTramo.direccion;
                }
                
                console.log(nextDirection);

                return {
                    ...baseSegment,
                    transferLine: tramo.linea?.toUpperCase() || 'UNKNOWN',
                    transferStation: transferStation,
                    direction: nextDirection,
                    ...(tramo.inicio && { from: this._processStation(tramo.inicio) }),
                    ...(tramo.fin && { to: this._processStation(tramo.fin) })
                };
            }

            // Original travel segment handling
            if (tramo.tipo === 'tramo') {
                return {
                    ...baseSegment,
                    from: this._processStation(tramo.inicio),
                    to: this._processStation(tramo.fin)
                };
            }

            // Original fallback
            logger.warn(`Unknown segment type encountered: ${tramo.tipo}`);
            return baseSegment;
        });
    }
    
    // COMPLETE original _processStation implementation
    static _processStation(stationData) {
        if (!stationData) {
            return {
                code: 'UNKN',
                name: 'Unknown station',
                line: 'UNKNOWN',
                accessibility: null
            };
        }

        return {
            code: stationData.sigla || 'UNKN',
            name: stationData.nombre || 'Unknown station',
            line: stationData.linea?.toUpperCase() || 'UNKNOWN',
            accessibility: this._cleanAccessibility(stationData.accesibilidad)
        };
    }

    // COMPLETE original _parseDuration implementation
    static _parseDuration(duration) {
        if (typeof duration === 'number') return duration;
        if (typeof duration !== 'string') return 0;
        
        const match = duration.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }

    // COMPLETE original _cleanAccessibility implementation
    static _cleanAccessibility(html) {
        if (!html) return null;
        
        return html
            .replace(/<[^>]+>/g, ' ')
            .replace(/&[a-z]+;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // COMPLETE original _generateRouteId implementation
    static _generateRouteId(route) {
        try {
            const firstStation = route.tramos[0]?.inicio?.sigla || 'start';
            const lastStation = route.tramos[route.tramos.length - 1]?.fin?.sigla || 'end';
            return `${firstStation}-${lastStation}-${Date.now().toString(36).slice(-6)}`;
        } catch (error) {
            logger.warn('Error generating route ID, using fallback', { error });
            return `route-${Date.now().toString(36).slice(-6)}`;
        }
    }
}

module.exports = RoutePlanner;
