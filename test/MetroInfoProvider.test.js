const MetroInfoProvider = require('../src/core/metro/providers/MetroInfoProvider');

describe('MetroInfoProvider', () => {
    it('should return a station by its ID', () => {
        const mockMetroCore = {
            api: {
                getProcessedData: () => ({
                    stations: {
                        '1': { id: '1', name: 'Station 1' },
                        '2': { id: '2', name: 'Station 2' },
                    },
                }),
            },
        };

        const infoProvider = new MetroInfoProvider(mockMetroCore);
        const station = infoProvider.getStationById('1');
        expect(station.name).toBe('Station 1');
    });
});
