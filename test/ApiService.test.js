const ApiService = require('../src/core/metro/core/services/ApiService');

// Mock dependencies
jest.mock('../src/events/logger', () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    detailed: jest.fn(),
}));

describe('ApiService', () => {
    let apiService;
    let mockMetro;
    let mockDataEngine;
    let mockEstadoRedService;

    beforeEach(() => {
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
            updateAllData: jest.fn().mockResolvedValue(true),
            getDbRawData: jest.fn().mockResolvedValue({ lines: {} }),
        };

        apiService = new ApiService(mockMetro, { dbService: mockDbService }, mockDataEngine);

        // Mock the internal EstadoRedService instance
        mockEstadoRedService = {
            fetchStatus: jest.fn(),
        };
        apiService.estadoRedService = mockEstadoRedService;
    });

    describe('getDbRawData', () => {
        beforeEach(() => {
            // Mock fs.promises.readFile
            jest.spyOn(require('fs').promises, 'readFile').mockImplementation(async (path) => {
                if (path.includes('apiChanges.json')) {
                    return JSON.stringify([
                        { timestamp: '2025-08-23T10:00:00.000Z', lines: { l1: { status: 'ok' } } },
                        { timestamp: '2025-08-23T12:00:00.000Z', lines: { l1: { status: 'perfect' } } }
                    ]);
                }
                return '';
            });
        });

        it('should fetch from DB when DB has newer data', async () => {
            apiService.dbService.getLatestStatusChange = jest.fn().mockResolvedValue({ changed_at: '2025-08-23T13:00:00.000Z' });

            // Mock the original DB fetching logic within getDbRawData
            apiService.dbService.getAllLinesStatus = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllStationsStatusAsRaw = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAccessibilityStatus = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllIncidents = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllIncidentTypes = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllTrainModels = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllLineFleet = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllStatusOverrides = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllScheduledStatusOverrides = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllJsStatusMapping = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllOperationalStatusTypes = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllStationStatusHistory = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllStatusChangeLog = jest.fn().mockResolvedValue([]);
            apiService.dbService.getSystemInfo = jest.fn().mockResolvedValue({});
            apiService.dbService.getIntermodalStations = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllIntermodalBuses = jest.fn().mockResolvedValue([]);
            apiService.dbService.getNetworkStatus = jest.fn().mockResolvedValue({});

            await apiService.getDbRawData();

            expect(apiService.dbService.getAllLinesStatus).toHaveBeenCalled();
        });

        it('should fetch data from the database', async () => {
            // Mock the original DB fetching logic within getDbRawData
            apiService.dbService.getAllLinesStatus = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllStationsStatusAsRaw = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAccessibilityStatus = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllIncidents = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllIncidentTypes = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllTrainModels = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllLineFleet = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllStatusOverrides = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllScheduledStatusOverrides = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllJsStatusMapping = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllOperationalStatusTypes = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllStationStatusHistory = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllStatusChangeLog = jest.fn().mockResolvedValue([]);
            apiService.dbService.getSystemInfo = jest.fn().mockResolvedValue({});
            apiService.dbService.getIntermodalStations = jest.fn().mockResolvedValue([]);
            apiService.dbService.getAllIntermodalBuses = jest.fn().mockResolvedValue([]);
            apiService.dbService.getNetworkStatus = jest.fn().mockResolvedValue({});

            await apiService.getDbRawData();

            expect(apiService.dbService.getAllLinesStatus).toHaveBeenCalled();
        });
    });
});
