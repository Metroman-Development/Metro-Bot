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

    describe('fetchNetworkStatus', () => {
        it('should fetch from API during operating hours and process through DataEngine', async () => {
            const mockApiData = { lines: { l1: { id: 'l1', nombre: 'Linea 1', estado: '1', estaciones: [] } }, version: '1.0.0' };
            mockEstadoRedService.fetchStatus.mockResolvedValue(mockApiData);
            apiService.timeHelpers.isWithinOperatingHours = jest.fn().mockReturnValue(true);

            const result = await apiService.fetchNetworkStatus();

            expect(mockEstadoRedService.fetchStatus).toHaveBeenCalled();
            expect(mockDataEngine.handleRawData).toHaveBeenCalledWith(expect.objectContaining({
                lines: expect.any(Object),
                stations: {},
                network: expect.any(Object),
            }));
            expect(result).toBeDefined();
        });

        it('should fall back to DB data if API fetch fails', async () => {
            mockEstadoRedService.fetchStatus.mockRejectedValue(new Error('API Down'));
            const mockDbData = { lines: { l1: { id: 'l1', nombre: 'Linea 1', estado: '1', estaciones: [] } }, version: '1.0.0' };
            apiService.getDbRawData = jest.fn().mockResolvedValue(mockDbData);
            apiService.timeHelpers.isWithinOperatingHours = jest.fn().mockReturnValue(true);

            const result = await apiService.fetchNetworkStatus();

            expect(mockEstadoRedService.fetchStatus).toHaveBeenCalled();
            expect(apiService.getDbRawData).toHaveBeenCalled();
            expect(mockDataEngine.handleRawData).toHaveBeenCalledWith(expect.objectContaining({
                lines: expect.any(Object),
                stations: {},
                network: expect.any(Object),
            }));
            expect(result).toBeDefined();
        });

        it('should generate off-hours data when outside operating hours', async () => {
            apiService.timeHelpers.isWithinOperatingHours = jest.fn().mockReturnValue(false);
            const mockOffHoursData = { lines: { l1: { id: 'l1', nombre: 'Linea 1', estado: '15', estaciones: [] } }, version: '1.0.0' };
            apiService._generateOffHoursData = jest.fn().mockResolvedValue(mockOffHoursData);

            const result = await apiService.fetchNetworkStatus();

            expect(mockEstadoRedService.fetchStatus).not.toHaveBeenCalled();
            expect(apiService._generateOffHoursData).toHaveBeenCalled();
            expect(mockDataEngine.handleRawData).toHaveBeenCalledWith(expect.objectContaining({
                lines: expect.any(Object),
                stations: {},
                network: expect.any(Object),
            }));
            expect(result).toBeDefined();
        });

        it('should return null and log an error if all data sources fail', async () => {
            mockEstadoRedService.fetchStatus.mockRejectedValue(new Error('API Down'));
            apiService.getDbRawData = jest.fn().mockRejectedValue(new Error('DB Down'));
            apiService.timeHelpers.isWithinOperatingHours = jest.fn().mockReturnValue(true);

            const result = await apiService.fetchNetworkStatus();

            expect(result).toBeNull();
            expect(apiService.metrics.failedRequests).toBe(1);
        });
    });
});
