const assert = require('assert');
const sinon = require('sinon');
const MetroInfoProvider = require('../src/utils/MetroInfoProvider');
const MetroCore = require('../src/core/metro/core/MetroCore');
const DatabaseService = require('../src/core/database/DatabaseService');

describe('MetroInfoProvider', () => {
    let provider;
    let metroCoreMock;
    let dbServiceMock;

    beforeEach(() => {
        metroCoreMock = sinon.stub(new MetroCore({}));
        dbServiceMock = sinon.stub(new DatabaseService({}));
        provider = new MetroInfoProvider(metroCoreMock, dbServiceMock);
    });

    afterEach(() => {
        sinon.restore();
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
            events: {},
            last_updated: null
        };
        assert.deepStrictEqual(provider.getFullData(), expectedData);
    });

    it('should update data correctly', () => {
        const newData = {
            lines: {
                l1: { id: 'L1', status: 'operational' }
            }
        };
        provider.updateData(newData);
        assert.deepStrictEqual(provider.getFullData().lines, newData.lines);
    });

    it('should update from API data correctly', () => {
        const apiData = {
            lineas: {
                l1: { id: 'L1', status: 'operational' }
            },
            network: {
                status: 'ok'
            },
            lastSuccessfulFetch: new Date()
        };
        provider.updateFromApi(apiData);
        const fullData = provider.getFullData();
        assert.deepStrictEqual(fullData.lines, apiData.lineas);
        assert.deepStrictEqual(fullData.network_status, apiData.network);
    });

    describe('applyChanges', () => {
        it('should fetch all data from database when changes are detected', async () => {
            const stationChanges = [{ history_id: 1 }];
            const lineChanges = [];
            const fullData = { lines: { l1: { id: 'L1' } }, stations: { s1: { id: 'S1' } } };

            provider.databaseService.getAllData = sinon.stub().resolves(fullData);

            await provider.applyChanges({ stationChanges, lineChanges });

            assert(provider.databaseService.getAllData.calledOnce);
            assert.deepStrictEqual(provider.getFullData().lines, fullData.lines);
            assert.deepStrictEqual(provider.getFullData().stations, fullData.stations);
        });

        it('should not do anything if there are no changes', async () => {
            const stationChanges = [];
            const lineChanges = [];

            provider.databaseService.getAllData = sinon.stub().resolves({});

            await provider.applyChanges({ stationChanges, lineChanges });

            assert(provider.databaseService.getAllData.notCalled);
        });
    });

    describe('getStationDetails', () => {
        it('should return null for non-existent station', () => {
            assert.strictEqual(provider.getStationDetails('non-existent'), null);
        });

        it('should return station details with connections', () => {
            const stationName = 'Test Station';
            const stationData = {
                'test-station': {
                    name: 'Test Station',
                    connections: ['l2', 'bus']
                }
            };
            provider.updateData({ stations: stationData, lines: { l1: {} }, intermodal: { buses: {} } });

            const details = provider.getStationDetails(stationName);

            assert.deepStrictEqual(details.connections, ['l2', 'bus']);
        });
    });

    describe('mergeData', () => {
        it('should prioritize API data if it is newer', () => {
            const apiTimestamp = new Date('2025-01-01T12:00:00Z');
            const dbTimestamp = new Date('2025-01-01T11:00:00Z');

            const apiData = {
                network: { timestamp: apiTimestamp.toISOString() },
                lineas: {
                    l1: { estado: 'api_line_status', estaciones: [{ id_estacion: 'st1', estado: 'api_station_status' }] }
                }
            };
            const dbData = {
                lines: [{ id: 'l1', last_updated: dbTimestamp.toISOString(), estado: 'db_line_status' }],
                stations: [{ station_code: 'st1', status_data: { last_updated: dbTimestamp.toISOString() }, estado: 'db_station_status' }]
            };

            const merged = provider.mergeData(apiData, dbData);

            assert.strictEqual(merged.lines.l1.estado, 'api_line_status');
            assert.strictEqual(merged.stations.ST1.estado, 'api_station_status');
        });

        it('should prioritize DB data if it is newer', () => {
            const apiTimestamp = new Date('2025-01-01T11:00:00Z');
            const dbTimestamp = new Date('2025-01-01T12:00:00Z');

            const apiData = {
                network: { timestamp: apiTimestamp.toISOString() },
                lineas: {
                    l1: { estaciones: [{ id_estacion: 'st1' }] }
                },
            };
            const dbData = {
                lines: [{ id: 'l1', last_updated: dbTimestamp.toISOString(), estado: 'db_line_status' }],
                stations: [{ station_code: 'st1', status_data: { last_updated: dbTimestamp.toISOString() }, estado: 'db_station_status' }]
            };

            const merged = provider.mergeData(apiData, dbData);

            assert.strictEqual(merged.lines.l1.estado, 'db_line_status');
            assert.strictEqual(merged.stations.ST1.estado, 'db_station_status');
        });

        it('should handle missing station in dbData gracefully', () => {
            const apiTimestamp = new Date('2025-01-01T12:00:00Z');

            const apiData = {
                network: { timestamp: apiTimestamp.toISOString() },
                lineas: {
                    l1: { estaciones: [{ id_estacion: 'st1', estado: 'api_station_status' }] }
                }
            };

            const dbData = {
                lines: [],
                stations: []
            };

            const merged = provider.mergeData(apiData, dbData);
            assert.strictEqual(merged.stations.ST1.estado, 'api_station_status');
        });

        it('should preserve API status when merging with richer DB data', () => {
            const apiTimestamp = new Date('2025-01-01T12:00:00Z');
            const dbTimestamp = new Date('2025-01-01T11:00:00Z');

            const apiData = {
                network: { timestamp: apiTimestamp.toISOString() },
                lineas: {
                    l1: {
                        estaciones: [{
                            id_estacion: 'st1',
                            estado: 'api_station_status',
                            descripcion: 'API Description',
                            descripcion_app: 'API App Description'
                        }]
                    }
                }
            };
            const dbData = {
                lines: [],
                stations: [{
                    station_code: 'st1',
                    station_name: 'Station One',
                    commune: 'Test Commune',
                    status_data: { last_updated: dbTimestamp.toISOString() },
                    estado: 'db_station_status'
                }]
            };

            const merged = provider.mergeData(apiData, dbData);

            assert.strictEqual(merged.stations.ST1.estado, 'api_station_status', 'API status should be preserved');
            assert.strictEqual(merged.stations.ST1.station_name, 'Station One', 'DB station name should be preserved');
            assert.strictEqual(merged.stations.ST1.commune, 'Test Commune', 'DB commune should be preserved');
            assert.strictEqual(merged.stations.ST1.descripcion, 'API Description', 'API description should be preserved');
        });
    });
});
