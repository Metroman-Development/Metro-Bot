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
});
