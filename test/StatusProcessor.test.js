const StatusProcessor = require('../src/core/status/utils/StatusProcessor');

describe('StatusProcessor', () => {
    let statusProcessor;
    let mockMetroCore;

    beforeEach(() => {
        mockMetroCore = {};
        statusProcessor = new StatusProcessor(mockMetroCore);
    });

    describe('_transformStation', () => {
        it('should correctly parse transfer string into transferLines array', () => {
            const stationData = {
                code: 'SA',
                name: 'Santa Ana',
                status: '1',
                description: 'Operativa',
                app_description: 'Operational',
                transfer: 'L2, L5'
            };

            const transformedStation = statusProcessor._transformStation(stationData, 'l1');
            expect(transformedStation.transferLines).toEqual(['l2', 'l5']);
        });

        it('should handle single transfer', () => {
            const stationData = {
                code: 'LH',
                name: 'Los Héroes',
                status: '1',
                description: 'Operativa',
                app_description: 'Operational',
                transfer: 'L2'
            };

            const transformedStation = statusProcessor._transformStation(stationData, 'l1');
            expect(transformedStation.transferLines).toEqual(['l2']);
        });

        it('should handle empty transfer string', () => {
            const stationData = {
                code: 'SP',
                name: 'San Pablo',
                status: '1',
                description: 'Operativa',
                app_description: 'Operational',
                transfer: ''
            };

            const transformedStation = statusProcessor._transformStation(stationData, 'l1');
            expect(transformedStation.transferLines).toEqual([]);
        });

        it('should handle null transfer', () => {
            const stationData = {
                code: 'SP',
                name: 'San Pablo',
                status: '1',
                description: 'Operativa',
                app_description: 'Operational',
                transfer: null
            };

            const transformedStation = statusProcessor._transformStation(stationData, 'l1');
            expect(transformedStation.transferLines).toEqual([]);
        });
    });

    describe('property preservation', () => {
        it('should preserve all original station properties', () => {
            const stationData = {
                code: 'TEST',
                name: 'Test Station',
                status: '1',
                transfer: 'L2',
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
            expect(transformedStation.code).toBe('TEST');
            expect(transformedStation.line).toBe('l1');
        });
    });
});
