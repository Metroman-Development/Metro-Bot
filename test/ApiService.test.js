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

    describe('_processData', () => {
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
            apiService.statusProcessor = mockStatusProcessor;

            apiService._processData(rawData);

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

    describe('_basicProcessData', () => {
        it('should add linea and other properties to stations', () => {
            const rawData = {
                lineas: {
                    l1: {
                        nombre: 'Linea 1',
                        estado: '1',
                        mensaje: '',
                        mensaje_app: '',
                        estaciones: [
                            {
                                codigo: 'SP',
                                nombre: 'San Pablo',
                                estado: '1',
                                descripcion: 'Operativa',
                                descripcion_app: 'Operational',
                                extra_field: 'extra_value'
                            }
                        ]
                    }
                }
            };

            const processedData = apiService._basicProcessData(rawData);

            const station = processedData.stations['SP'];
            expect(station).toBeDefined();
            expect(station.linea).toBe('l1');
            expect(station.id).toBe('SP');
            expect(station.name).toBe('San Pablo');
            expect(station.extra_field).toBe('extra_value');
        });
    });

    describe('getCurrentData', () => {
        it('should return processed data from the database', async () => {
            const mockDbData = {
                lineas: {
                    l1: {
                        nombre: 'Linea 1',
                        estado: '1',
                        mensaje: '',
                        mensaje_app: '',
                        estaciones: [{
                            codigo: 'SP',
                            nombre: 'San Pablo',
                            estado: '1',
                            descripcion: 'Operativa',
                            descripcion_app: 'Operational',
                        }]
                    }
                }
            };
            apiService.getDbRawData = jest.fn().mockResolvedValue(mockDbData);

            const processedData = await apiService.getCurrentData();

            expect(apiService.getDbRawData).toHaveBeenCalled();
            expect(processedData).toHaveProperty('lines');
            expect(processedData).toHaveProperty('stations');
            expect(processedData.lines.l1.displayName).toBe('Linea 1');
            expect(processedData.stations.SP.name).toBe('San Pablo');
        });

        it('should correctly process data when dbStations is an object', async () => {
            const mockStations = {
                'SP': {
                    line_id: 'l1',
                    station_code: 'SP',
                    nombre: 'San Pablo',
                    estado: '1',
                    descripcion: 'Operativa',
                    descripcion_app: 'Operational',
                }
            };

            apiService.dbService.getAllLinesStatus.mockResolvedValue([{ line_id: 'l1', line_name: 'Linea 1', status_code: '1', status_message: '', app_message: '' }]);
            apiService.dbService.getAllStationsStatusAsRaw.mockResolvedValue(mockStations);
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

            const processedData = await apiService.getCurrentData();

            expect(processedData).toHaveProperty('lines');
            expect(processedData).toHaveProperty('stations');
            expect(processedData.lines.l1.displayName).toBe('Linea 1');
            expect(processedData.stations.SP.name).toBe('San Pablo');
            expect(Array.isArray(processedData.lines.l1.stations)).toBe(true);
        });
    });
});
