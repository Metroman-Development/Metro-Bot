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
                getLatestChangeTimestamp: sinon.stub().resolves(new Date('2023-01-02'))
            };
            provider.dbChangeDetector = {
                getLatestChangeTimestamp: sinon.stub().resolves(new Date('2023-01-01')),
                databaseService: {
                    updateStatusFromApi: sinon.stub().resolves()
                }
            };
            provider.changeDetector = {
                detect: jest.fn()
            };
            provider.changeAnnouncer = {
                generateMessages: jest.fn().mockResolvedValue([])
            };
        });

        it('should call changeDetector.detect with old and new data', async () => {
            const oldData = JSON.parse(JSON.stringify(provider.getFullData()));
            const apiData = {};
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
