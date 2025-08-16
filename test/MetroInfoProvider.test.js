// test/MetroInfoProvider.test.js
const MetroInfoProvider = require('../src/utils/MetroInfoProvider');

describe('MetroInfoProvider', () => {
    it('should be a singleton', () => {
        const instance1 = require('../src/utils/MetroInfoProvider');
        const instance2 = require('../src/utils/MetroInfoProvider');
        expect(instance1).toBe(instance2);
    });

    it('should initialize with empty data', () => {
        const provider = require('../src/utils/MetroInfoProvider');
        provider.updateData(null); // Reset data
        expect(provider.getFullData()).toEqual({ lines: {}, stations: {} });
    });

    it('should update data correctly', () => {
        const provider = require('../src/utils/MetroInfoProvider');
        const newData = {
            lines: { l1: { id: 'L1' } },
            stations: { s1: { id: 'S1' } },
        };
        provider.updateData(newData);
        expect(provider.getFullData()).toEqual(newData);
    });

    it('should get lines correctly', () => {
        const provider = require('../src/utils/MetroInfoProvider');
        const newData = {
            lines: { l1: { id: 'L1' } },
            stations: { s1: { id: 'S1' } },
        };
        provider.updateData(newData);
        expect(provider.getLines()).toEqual(newData.lines);
    });

    it('should get stations correctly', () => {
        const provider = require('../src/utils/MetroInfoProvider');
        const newData = {
            lines: { l1: { id: 'L1' } },
            stations: { s1: { id: 'S1' } },
        };
        provider.updateData(newData);
        expect(provider.getStations()).toEqual(newData.stations);
    });
});
