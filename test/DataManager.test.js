const MetroInfoProvider = require('../src/utils/MetroInfoProvider');
const DataManager = require('../src/core/metro/core/services/DataManager');
const DbDataManager = require('../src/core/metro/core/services/DbDataManager');
const TimeHelpers = require('../src/utils/timeHelpers');
const logger = require('../src/events/logger');

// Mock dependencies
jest.mock('../src/events/logger', () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    detailed: jest.fn(),
}));

jest.mock('../src/core/metro/core/services/DbDataManager');
jest.mock('../src/utils/timeHelpers');

describe('DataManager', () => {
    let dataManager;
    let mockMetro;
    let mockDataEngine;
    let mockDbDataManager;

    beforeEach(() => {
        jest.clearAllMocks(); // Clear mocks before each test

        const mockMIPDbService = { /* empty mock */ };
        const mockStatusEmbedManager = { /* empty mock */ };
        MetroInfoProvider.initialize(mockMIPDbService, mockStatusEmbedManager);

        mockDataEngine = {
            handleRawData: jest.fn(data => Promise.resolve(data)),
        };

        mockMetro = {
            _subsystems: {
                statusOverrideService: {
                    getActiveOverrides: jest.fn().mockResolvedValue({}),
                    applyOverrides: jest.fn((data) => data),
                },
            },
        };

        const mockDbService = {
            getAllJsStatusMapping: jest.fn().mockResolvedValue([]),
        };

        mockDbDataManager = new DbDataManager(mockDbService);
        mockDbDataManager.dbService = mockDbService;
        mockDbDataManager._initializeLineMetadata = jest.fn().mockResolvedValue(true);
        mockDbDataManager.lineInfoMap = new Map([['l1', 'Línea 1']]);

        dataManager = new DataManager({ dbService: mockDbService }, mockDataEngine);
        dataManager.dbDataManager = mockDbDataManager;

        TimeHelpers.isWithinOperatingHours.mockReturnValue(true);
        TimeHelpers.currentTime = {
            toISOString: () => '2025-09-01T22:01:22.287Z'
        };
    });

    afterEach(() => {
        MetroInfoProvider.instance = null;
    });

    describe('Status Translation', () => {
        it('should correctly translate line and station statuses based on js_status_mapping', async () => {
            const mockDbRawData = {
                lines: {
                    L1: {
                        estado: '1',
                        nombre: 'Línea 1',
                        mensaje_app: 'Operational',
                        estaciones: [
                            { codigo: 'SP', nombre: 'San Pablo', estado: '1', descripcion: 'Operativa', descripcion_app: 'Habilitada' },
                            { codigo: 'LP', nombre: 'Los Dominicos', estado: '2', descripcion: 'Con demoras', descripcion_app: 'Con demoras' }
                        ]
                    }
                },
                changeHistory: []
            };
            const mockStatusMapping = [
                { js_code: '1', status_type_id: 1, severity_level: 0, station_t: 10, line_t: 100 },
                { js_code: '2', status_type_id: 2, severity_level: 1, station_t: 20, line_t: 200 }
            ];

            const mockDbService = {
                getAllJsStatusMapping: jest.fn().mockResolvedValue(mockStatusMapping),
            };
            dataManager.dbDataManager.dbService = mockDbService;

            mockDbDataManager.getDbRawData.mockResolvedValue(mockDbRawData);

            const result = await dataManager.fetchNetworkStatus();

            expect(result.lines.L1.status).toBe(100);
            expect(result.stations.SP.status).toBe(10);
            expect(result.stations.LP.status).toBe(20);
        });
    });
});
