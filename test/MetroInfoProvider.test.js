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

    describe('compareAndSyncData', () => {
        beforeEach(() => {
            // Mock the dependencies of compareAndSyncData
            provider.apiChangeDetector = {
                fetchData: sinon.stub().resolves({ lineas: {}, network: {} })
            };
            provider.dbChangeDetector = {
                fetchData: sinon.stub().resolves({ lines: [], stations: [] })
            };
            provider.changeDetector = {
                detect: sinon.stub().returns([])
            };
            provider.changeAnnouncer = {
                generateMessages: sinon.stub().resolves()
            };
            provider.statusEmbedManager = {
                updateAllEmbeds: sinon.stub().resolves()
            };
        });

        it('should merge data correctly', async () => {
            const apiData = { lineas: { l1: { id: 'L1', status: 'api_status', estaciones: [] } }, network: { status: 'api_status' } };
            const dbData = { lines: [{ id: 'l2', status: 'db_status' }], stations: [{ id: 'st1', name: 'station1' }] };
            provider.apiChangeDetector.fetchData.resolves(apiData);
            provider.dbChangeDetector.fetchData.resolves(dbData);
            provider.changeDetector.detect.returns([{ type: 'line', id: 'l1', from: null, to: 'api_status' }]);

            await provider.compareAndSyncData();

            const mergedData = provider.getFullData();
            assert.deepStrictEqual(mergedData.lines.l1, { id: 'L1', status: 'api_status', estaciones: [] });
            assert.deepStrictEqual(mergedData.lines.l2, { id: 'l2', status: 'db_status' });
            assert.deepStrictEqual(mergedData.stations.st1, { id: 'st1', name: 'station1' });
            assert.deepStrictEqual(mergedData.network_status, { status: 'api_status' });
            assert(provider.changeAnnouncer.generateMessages.calledOnce);
            assert(provider.statusEmbedManager.updateAllEmbeds.calledOnce);
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
});
