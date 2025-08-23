const assert = require('assert');
const sinon = require('sinon');
const MetroInfoProvider = require('../src/utils/MetroInfoProvider');
const TimeService = require('../src/core/chronos/TimeService');

describe('MetroInfoProvider', () => {
    let provider;
    let timeHelpers;

    beforeEach(() => {
        provider = require('../src/utils/MetroInfoProvider');
        provider.updateData(null); // Reset data
        timeHelpers = sinon.createStubInstance(TimeService);
    });

    it('should be a singleton', () => {
        const instance1 = require('../src/utils/MetroInfoProvider');
        const instance2 = require('../src/utils/MetroInfoProvider');
        assert.strictEqual(instance1, instance2);
    });

    it('should initialize with empty data', () => {
        assert.deepStrictEqual(provider.getFullData(), {
            lines: {},
            network_status: {},
            stations: {},
            last_updated: null
        });
    });

    it('should update data correctly', () => {
        const newData = {
            lines: { l1: { id: 'L1' } },
            network_status: { status: 'operational' },
            stations: { s1: { id: 'S1' } },
            last_updated: new Date()
        };
        provider.updateData(newData);
        assert.deepStrictEqual(provider.getFullData(), newData);
    });

    it('should update from API data correctly', () => {
        const apiData = {
            lineas: { l1: { id: 'L1' } },
            network: { status: 'operational' },
            lastSuccessfulFetch: new Date()
        };
        provider.updateFromApi(apiData, timeHelpers);
        const fullData = provider.getFullData();
        assert.deepStrictEqual(fullData.lines, apiData.lineas);
        assert.deepStrictEqual(fullData.network_status, apiData.network);
    });

    it('should update from DB data correctly', () => {
        const dbData = {
            stations: { s1: { id: 'S1' } }
        };
        const currentTime = new Date();
        timeHelpers.currentTime = currentTime;
        provider.updateFromDb(dbData, timeHelpers);
        const fullData = provider.getFullData();
        assert.deepStrictEqual(fullData.stations, dbData.stations);
        assert.deepStrictEqual(fullData.last_updated, currentTime);
    });
});
