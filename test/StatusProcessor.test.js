const StatusProcessor = require('../src/core/status/utils/StatusProcessor');

describe('StatusProcessor', () => {
    let statusProcessor;
    let mockMetroCore;

    beforeEach(() => {
        mockMetroCore = {};
        statusProcessor = new StatusProcessor(mockMetroCore);
    });

    describe('_transformStation', () => {
        it('should correctly parse combinacion string into transferLines array', () => {
            const stationData = {
                codigo: 'SA',
                nombre: 'Santa Ana',
                estado: '1',
                descripcion: 'Operativa',
                descripcion_app: 'Operational',
                combinacion: 'L2, L5'
            };

            const transformedStation = statusProcessor._transformStation(stationData, 'l1');
            expect(transformedStation.transferLines).toEqual(['l2', 'l5']);
        });

        it('should handle single combinacion', () => {
            const stationData = {
                codigo: 'LH',
                nombre: 'Los Héroes',
                estado: '1',
                descripcion: 'Operativa',
                descripcion_app: 'Operational',
                combinacion: 'L2'
            };

            const transformedStation = statusProcessor._transformStation(stationData, 'l1');
            expect(transformedStation.transferLines).toEqual(['l2']);
        });

        it('should handle empty combinacion string', () => {
            const stationData = {
                codigo: 'SP',
                nombre: 'San Pablo',
                estado: '1',
                descripcion: 'Operativa',
                descripcion_app: 'Operational',
                combinacion: ''
            };

            const transformedStation = statusProcessor._transformStation(stationData, 'l1');
            expect(transformedStation.transferLines).toEqual([]);
        });

        it('should handle null combinacion', () => {
            const stationData = {
                codigo: 'SP',
                nombre: 'San Pablo',
                estado: '1',
                descripcion: 'Operativa',
                descripcion_app: 'Operational',
                combinacion: null
            };

            const transformedStation = statusProcessor._transformStation(stationData, 'l1');
            expect(transformedStation.transferLines).toEqual([]);
        });
    });

    describe('property preservation', () => {
        it('should preserve all original station properties', () => {
            const stationData = {
                codigo: 'TEST',
                nombre: 'Test Station',
                estado: '1',
                combinacion: 'L2',
                transports: 'Bus, Taxi',
                services: 'ATM, Wifi',
                accessibility: 'Full',
                commerce: 'Cafe',
                amenities: 'Restrooms',
                image_url: 'http://example.com/image.png'
            };

            const transformedStation = statusProcessor._transformStation(stationData, 'l1');

            expect(transformedStation.transports).toBe('Bus, Taxi');
            expect(transformedStation.services).toBe('ATM, Wifi');
            expect(transformedStation.accessibility).toBe('Full');
            expect(transformedStation.commerce).toBe('Cafe');
            expect(transformedStation.amenities).toBe('Restrooms');
            expect(transformedStation.image_url).toBe('http://example.com/image.png');
            // Also check a transformed property to be sure
            expect(transformedStation.id).toBe('TEST');
            expect(transformedStation.line).toBe('l1');
        });
    });
});
