const SearchCore = require('../src/core/metro/search/SearchCore');
const DataManager = require('../src/core/metro/data/DataManager');

jest.mock('../src/core/metro/data/DataManager');

describe('SearchCore', () => {
    let searchCore;

    beforeAll(async () => {
        DataManager.prototype.getStations.mockReturnValue({
            'SBA': { id: 'SBA', name: 'San Alberto Hurtado', line: 'l1' },
            'PDA': { id: 'PDA', name: 'Plaza de Armas', line: 'l5' },
        });
        searchCore = new SearchCore('station');
        await searchCore.init();
    }, 30000);

    it('should return a station by its uppercase ID', async () => {
        const station = await searchCore.getById('SBA');
        expect(station).not.toBeNull();
        expect(station.name).toBe('San Alberto Hurtado');
    });

    it('should return a station by its lowercase ID', async () => {
        const station = await searchCore.getById('sba');
        expect(station).not.toBeNull();
        expect(station.name).toBe('San Alberto Hurtado');
    });

    it('should return a station from a search with an uppercase query', async () => {
        const stations = await searchCore.search('SBA');
        expect(stations).not.toBeNull();
        expect(stations.length).toBeGreaterThan(0);
        expect(stations[0].name).toBe('San Alberto Hurtado');
    });

    it('should return a station from a search with a lowercase query', async () => {
        const stations = await searchCore.search('sba');
        expect(stations).not.toBeNull();
        expect(stations.length).toBeGreaterThan(0);
        expect(stations[0].name).toBe('San Alberto Hurtado');
    });
});
