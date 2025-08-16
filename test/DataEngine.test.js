const DataEngine = require('../src/core/metro/core/internal/DataEngine');

describe('DataEngine', () => {
    it('should add network status to the combined data', () => {
        const mockMetro = {
            _staticData: {},
            _dynamicData: {
                lines: {
                    l1: { id: 'l1', status: '1' },
                    l2: { id: 'l2', status: '2' },
                }
            },
            _subsystems: {
                managers: {
                    stations: { updateData: jest.fn() },
                    lines: { updateData: jest.fn() }
                }
            }
        };

        const dataEngine = new DataEngine(mockMetro);
        const combinedData = dataEngine.combine();

        expect(combinedData).toHaveProperty('network');
        expect(combinedData.network).toHaveProperty('status', 'degraded');
        expect(combinedData.network).toHaveProperty('lastUpdated');
    });

    it('should have network status as operational when all lines are operational', () => {
        const mockMetro = {
            _staticData: {},
            _dynamicData: {
                lines: {
                    l1: { id: 'l1', status: '1' },
                    l2: { id: 'l2', status: '1' },
                }
            },
            _subsystems: {
                managers: {
                    stations: { updateData: jest.fn() },
                    lines: { updateData: jest.fn() }
                }
            }
        };

        const dataEngine = new DataEngine(mockMetro);
        const combinedData = dataEngine.combine();

        expect(combinedData).toHaveProperty('network');
        expect(combinedData.network).toHaveProperty('status', 'operational');
    });

    it('should have network status as outage when all lines are down', () => {
        const mockMetro = {
            _staticData: {},
            _dynamicData: {
                lines: {
                    l1: { id: 'l1', status: '4' },
                    l2: { id: 'l2', status: '4' },
                }
            },
            _subsystems: {
                managers: {
                    stations: { updateData: jest.fn() },
                    lines: { updateData: jest.fn() }
                }
            }
        };

        const dataEngine = new DataEngine(mockMetro);
        const combinedData = dataEngine.combine();

        expect(combinedData).toHaveProperty('network');
        expect(combinedData.network).toHaveProperty('status', 'outage');
    });
});
