const ApiService = require('../src/core/metro/core/services/ApiService');
const EventRegistry = require('../src/core/EventRegistry');

// Mock dependencies
jest.mock('../src/events/logger', () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

describe('ApiService', () => {
    let apiService;
    let mockMetro;

    beforeEach(() => {
        mockMetro = {
            _subsystems: {
                statusOverrideService: {
                    getActiveOverrides: jest.fn().mockResolvedValue({}),
                    applyOverrides: jest.fn((data) => data),
                },
            },
            refreshStaticData: jest.fn(),
            api: {
                getDataFreshness: jest.fn().mockReturnValue({ lastRefresh: null }),
            }
        };

        const mockDbService = {
            updateNetworkStatusSummary: jest.fn(),
            getAllLinesStatus: jest.fn().mockResolvedValue([]),
            getAllStationsStatusAsRaw: jest.fn().mockResolvedValue([]),
            updateLineStatus: jest.fn(),
            updateStationStatus: jest.fn(),
        };

        apiService = new ApiService(mockMetro, { dbService: mockDbService });
    });

    describe('dataProcessor.processData', () => {
        it('should translate raw data before processing', () => {
            const rawData = {
                lineas: {
                    l1: {
                        estado: '1',
                        estaciones: [
                            { estado: '1' },
                            { estado: '2' },
                        ]
                    },
                    l2: {
                        estado: '2',
                        estaciones: [
                            { estado: '3' },
                        ]
                    }
                }
            };

            const mockStatusProcessor = {
                processRawAPIData: jest.fn(data => data)
            };
            apiService.dataProcessor.statusProcessor = mockStatusProcessor;

            apiService.dataProcessor.processData(rawData, '1.0.0');

            expect(mockStatusProcessor.processRawAPIData).toHaveBeenCalledWith({
                lineas: {
                    l1: {
                        estado: '10',
                        estaciones: [
                            { estado: '1' },
                            { estado: '5' },
                        ]
                    },
                    l2: {
                        estado: '13',
                        estaciones: [
                            { estado: '4' },
                        ]
                    }
                }
            });
        });
    });

    it('should add a version to raw data if it is missing', () => {
        const rawData = {
            lines: { l1: { id: 'l1', status: '1' } },
            stations: { s1: { id: 's1', name: 'Station 1' } },
            network: { status: 'operational' },
            lastUpdated: new Date().toISOString()
        };

        apiService.emit = jest.fn();

        apiService._emitRawData(rawData, false);

        expect(apiService.emit).toHaveBeenCalledWith(EventRegistry.RAW_DATA_FETCHED, expect.any(Object));

        const emittedPayload = apiService.emit.mock.calls[0][1];
        expect(emittedPayload.data).toHaveProperty('version');
        expect(typeof emittedPayload.data.version).toBe('string');
        expect(emittedPayload.data.version.length).toBeGreaterThanOrEqual(10);
    });

    it('should not overwrite an existing version on raw data', () => {
        const rawData = {
            lines: {},
            stations: {},
            network: { status: 'operational' },
            version: 'existing-version-123',
        };

        apiService.emit = jest.fn();

        apiService._emitRawData(rawData, false);

        const emittedPayload = apiService.emit.mock.calls[0][1];
        expect(emittedPayload.data.version).toBe('existing-version-123');
    });

    describe('_handleDataChanges', () => {
        it('should save the last 10 api changes to apiChanges.json', async () => {
            const fsp = require('fs').promises;
            fsp.readFile = jest.fn().mockResolvedValue(JSON.stringify(new Array(10).fill({})));
            fsp.writeFile = jest.fn();

            apiService.changeDetector = {
                analyze: jest.fn().mockReturnValue({ changes: [{ id: 'l1', to: '2' }] })
            };

            await apiService._handleDataChanges({}, {}, {});

            expect(fsp.writeFile).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                'utf8'
            );

            const writtenData = JSON.parse(fsp.writeFile.mock.calls[0][1]);
            expect(writtenData.length).toBe(10);
        });
    });
});
