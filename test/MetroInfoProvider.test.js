const assert = require('assert');
const sinon = require('sinon');
const ChangeDetector = require('../src/core/status/ChangeDetector');
const ChangeAnnouncer =require('../src/core/status/ChangeAnnouncer');

// Mock the dependencies before requiring MetroInfoProvider
jest.mock('../src/core/metro/core/services/changeDetectors/ApiChangeDetector', () => {
    return jest.fn().mockImplementation(() => {
        return {
            getLatestChangeTimestamp: jest.fn().mockResolvedValue(new Date('2025-01-01T12:00:00Z')),
        };
    });
});

jest.mock('../src/core/metro/core/services/changeDetectors/DbChangeDetector', () => {
    return jest.fn().mockImplementation(() => {
        return {
            getLatestChangeTimestamp: jest.fn().mockResolvedValue(new Date('2025-01-01T11:00:00Z')),
            databaseService: {
                updateStatusFromApi: jest.fn().mockResolvedValue(undefined),
            },
        };
    });
});

jest.mock('../src/core/metro/core/services/ApiService', () => {
    return jest.fn().mockImplementation(() => {
        return {
            fetchData: jest.fn().mockResolvedValue({
                lastSuccessfulFetch: new Date(),
                lineas: {},
                network: {},
            }),
        };
    });
});

jest.mock('../src/core/database/DatabaseService', () => {
    return jest.fn().mockImplementation(() => {
        return {
            getLatestChange: jest.fn().mockResolvedValue({ changed_at: new Date() }),
            updateStatusFromApi: jest.fn().mockResolvedValue(undefined),
        };
    });
});

jest.mock('../src/core/database/DatabaseManager', () => {
    return jest.fn().mockImplementation(() => {
        return {};
    });
});

jest.mock('../src/core/status/ChangeDetector', () => {
    return jest.fn().mockImplementation(() => {
        return {
            detect: jest.fn().mockReturnValue([]),
        };
    });
});

jest.mock('../src/core/status/ChangeAnnouncer', () => {
    return jest.fn().mockImplementation(() => {
        return {
            generateMessages: jest.fn().mockResolvedValue([]),
        };
    });
});


const MetroInfoProvider = require('../src/utils/MetroInfoProvider');

describe('MetroInfoProvider', () => {
    let provider;

    beforeEach(() => {
        // Now, we can safely require the module
        provider = require('../src/utils/MetroInfoProvider');
        provider.updateData(null); // Reset data
        jest.clearAllMocks();
    });

    it('should be a singleton', () => {
        const instance1 = require('../src/utils/MetroInfoProvider');
        const instance2 = require('../src/utils/MetroInfoProvider');
        assert.strictEqual(instance1, instance2);
    });

    it('should initialize with empty data', () => {
        const expectedData = {
            lines: {},
            stations: {},
            trains: {},
            intermodal: {
                stations: {},
                buses: {}
            },
            futureLines: {},
            accessibility: {},
            network_status: {},
            last_updated: null
        };
        assert.deepStrictEqual(provider.getFullData(), expectedData);
    });

    it('should update data correctly', () => {
        const newData = {
            lines: { l1: { id: 'L1' } },
            network_status: { status: 'operational' },
            stations: { s1: { id: 'S1' } },
            last_updated: new Date()
        };
        provider.updateData(newData);
        const expectedData = {
            ...provider.getFullData(),
            ...newData,
        };
        assert.deepStrictEqual(provider.getFullData(), expectedData);
    });

    it('should update from API data correctly', () => {
        const apiData = {
            lineas: { l1: { id: 'L1' } },
            network: { status: 'operational' },
            lastSuccessfulFetch: new Date()
        };
        provider.updateFromApi(apiData);
        const fullData = provider.getFullData();
        assert.deepStrictEqual(fullData.lines, apiData.lineas);
        assert.deepStrictEqual(fullData.network_status, apiData.network);
    });

    it('should update from DB data correctly', () => {
        const dbData = {
            stations: { s1: { id: 'S1' } }
        };
        provider.updateFromDb(dbData);
        const fullData = provider.getFullData();
        assert.deepStrictEqual(fullData.stations, dbData.stations);
    });

    describe('compareAndSyncData', () => {
        it('should call changeDetector.detect with old and new data', async () => {
            const oldData = provider.getFullData();
            const apiData = { lineas: { l1: { id: 'L1', status: 'new_status' } } };
            const dbData = {};

            await provider.compareAndSyncData(apiData, dbData);

            expect(provider.changeDetector.detect).toHaveBeenCalledWith(oldData, provider.getFullData());
        });

        it('should call changeAnnouncer.generateMessages when changes are detected', async () => {
            const changes = [{ type: 'line', id: 'l1', from: null, to: 'new_status' }];
            provider.changeDetector.detect.mockReturnValue(changes);

            const apiData = { lineas: { l1: { id: 'L1', status: 'new_status' } } };
            const dbData = {};

            await provider.compareAndSyncData(apiData, dbData);

            expect(provider.changeAnnouncer.generateMessages).toHaveBeenCalledWith(changes, provider.getFullData());
        });

        it('should not call changeAnnouncer.generateMessages when no changes are detected', async () => {
            provider.changeDetector.detect.mockReturnValue([]);

            const apiData = { lineas: { l1: { id: 'L1', status: 'new_status' } } };
            const dbData = {};

            await provider.compareAndSyncData(apiData, dbData);

            expect(provider.changeAnnouncer.generateMessages).not.toHaveBeenCalled();
        });
    });

    describe('getStationDetails', () => {
        it('should return station details with connections', () => {
            const stationName = 'Test Station';
            const stationData = {
                'test-station': {
                    station_id: 'test-station',
                    station_name: stationName,
                    line_id: 'l1',
                    route_color: 'R',
                    express_state: 'Operational',
                    combinacion: 'l2',
                    connections: ['l2', 'bus'],
                    access_details: 'some details',
                    services: 'some services',
                    accessibility: 'accessible',
                    amenities: 'some amenities',
                    commune: 'Test Commune',
                    platforms: [],
                    status: {
                        code: '1',
                        message: 'Operativa'
                    }
                }
            };

            provider.updateData({ stations: stationData, lines: { l1: {} }, intermodal: { buses: {} } });

            const details = provider.getStationDetails(stationName);

            assert.deepStrictEqual(details.connections, ['l2', 'bus']);
        });
    });
});
