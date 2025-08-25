const SearchCore = require('../src/core/metro/search/SearchCore');
const MetroInfoProvider = require('../src/utils/MetroInfoProvider');

jest.mock('../src/utils/MetroInfoProvider', () => {
    return {
        getStations: jest.fn().mockReturnValue({
            'SBA': { id: 'SBA', name: 'San Alberto Hurtado', displayName: 'San Alberto Hurtado', line: 'l1' },
            'PDA': { id: 'PDA', name: 'Plaza de Armas', displayName: 'Plaza de Armas', line: 'l5' },
            'UCH': { id: 'UCH', name: 'Universidad de Chile', displayName: 'Universidad de Chile', line: 'l1' },
        }),
        getLines: jest.fn().mockReturnValue({}),
    };
});

describe('SearchCore', () => {
    let searchCore;

    beforeAll(async () => {
        searchCore = new SearchCore('station');
        await searchCore.init();
    });

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

    it('should return a station from a search with an exact name', async () => {
        const stations = await searchCore.search('Plaza de Armas');
        expect(stations).not.toBeNull();
        expect(stations.length).toBe(1);
        expect(stations[0].name).toBe('Plaza de Armas');
    });

    it('should return a station from a search with a partial name', async () => {
        const stations = await searchCore.search('alberto');
        expect(stations).not.toBeNull();
        expect(stations.length).toBeGreaterThan(0);
        expect(stations[0].name).toBe('San Alberto Hurtado');
    });

    it('should return a station from a search with a typo', async () => {
        const stations = await searchCore.search('universidad de shile');
        expect(stations).not.toBeNull();
        expect(stations.length).toBeGreaterThan(0);
        expect(stations[0].name).toBe('Universidad de Chile');
    });
});
