// File: RoutePlanner.js
// File: RoutePlanner.js
const logger = require('../../events/logger');
const config = require('../../config/metro/metroConfig');

class RoutePlanner {
    static async getRoutes(startCode, endCode, farePeriod) {
        try {
            // Validate inputs
            if (!startCode || !endCode || !farePeriod) {
                throw new Error('Missing required parameters: startCode, endCode, or farePeriod');
            }

            const apiUrl = `https://www.metro.cl/api/planificadorv2.php?estacionInicio=${startCode.toUpperCase()}&estacionFin=${endCode.toUpperCase()}&dia=dl&hora=${farePeriod.toUpperCase()}`;
            
            logger.debug(`Fetching routes from: ${apiUrl}`);
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Validate response structure
            if (data.estado !== 1) {
                logger.warn(`API returned non-success state: ${data.mensaje || 'Unknown error'}`);
                return null;
            }

            if (!data.rutas || !Array.isArray(data.rutas) || data.rutas.length === 0) {
                logger.info('No routes found in response');
                return null;
            }

            return this._processRoutes(data.rutas, farePeriod);
        } catch (error) {
            logger.error(`RoutePlanner Error: ${error.message}`, { error });
            return null;
        }
    }

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

    static _processSegments(tramos, farePeriod) {
    return tramos.map((tramo, index) => {
        const baseSegment = {
            type: tramo.tipo || 'unknown',
            duration: this._parseDuration(tramo.tiempo),
            direction: tramo.direccion || 'Unknown direction',
            farePeriod: farePeriod
        };

        // Handle transfer segments
        if (tramo.tipo === 'combinacion' || tramo.tipo === 'cambio') {
            // Find the previous or next station to use as transfer station
            let transferStation = null;
            let nextDirection = null;
            
            // Check previous segment first
            if (index > 0 && tramos[index - 1].fin) {
                transferStation = this._processStation(tramos[index - 1].fin);
            } 
            // If no previous segment end, check next segment start
            else if (index < tramos.length - 1 && tramos[index + 1].inicio) {
                transferStation = this._processStation(tramos[index + 1].inicio);
            }
            // Fallback to direction if no station found
            else {
                transferStation = {
                    code: 'UNKN',
                    name: tramo.direccion || 'Unknown transfer station',
                    line: tramo.linea?.toUpperCase() || 'UNKNOWN',
                    accessibility: null
                };
            }

            
           /* console.log("95RP"
                        , tramos[index + 1]) */
            
            
            const nextTramo = tramos[index + 1]
            // Get direction from next segment if available
            if (nextTramo?.direccion) {
                
                
                
                nextDirection = nextTramo.direccion;
            }
            
            console.log(nextDirection) 

            return {
                ...baseSegment,
                transferLine: tramo.linea?.toUpperCase() || 'UNKNOWN',
                transferStation: transferStation,
                direction: nextDirection, // Use next segment's direction if available
                ...(tramo.inicio && { from: this._processStation(tramo.inicio) }),
                ...(tramo.fin && { to: this._processStation(tramo.fin) })
            };
        }

        // Handle regular travel segments
        if (tramo.tipo === 'tramo') {
            return {
                ...baseSegment,
                from: this._processStation(tramo.inicio),
                to: this._processStation(tramo.fin)
            };
        }

        // Fallback for unknown segment types
        logger.warn(`Unknown segment type encountered: ${tramo.tipo}`);
        return baseSegment;
    });
}
    
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

    static _parseDuration(duration) {
        if (typeof duration === 'number') return duration;
        if (typeof duration !== 'string') return 0;
        
        // Handle both "5 minutos" and "5" formats
        const match = duration.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }

    static _cleanAccessibility(html) {
        if (!html) return null;
        
        // Improved HTML cleaning that handles nested tags and entities
        return html
            .replace(/<[^>]+>/g, ' ')  // Remove all HTML tags
            .replace(/&[a-z]+;/g, ' ')  // Remove HTML entities
            .replace(/\s+/g, ' ')       // Collapse multiple spaces
            .trim();
    }

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