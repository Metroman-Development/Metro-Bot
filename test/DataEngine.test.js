const DataEngine = require('../src/core/metro/core/internal/DataEngine');
const EventRegistry = require('../src/core/EventRegistry');

describe('DataEngine', () => {
    let mockMetro;
    let dataEngine;

    beforeEach(() => {
        mockMetro = {
            _subsystems: {
                managers: {
                    stations: { updateData: jest.fn() },
                    lines: { updateData: jest.fn() }
                },
                metroInfoProvider: { updateData: jest.fn() }
            },
            _combinedData: null,
            _safeEmit: jest.fn(),
            _emitError: jest.fn()
        };
        dataEngine = new DataEngine(mockMetro);
    });

    it('should process valid data and update all subsystems', async () => {
        const currentData = {
            network: { status: 'operational', timestamp: new Date().toISOString() },
            version: '3.0.0',
            lines: { 'l1': { id: 'l1', status: 'operational' } },
            stations: { 'st1': { id: 'st1', name: 'Station 1' } }
        };

        const result = await dataEngine.handleRawData(currentData);

        expect(result).toBe(currentData);
        expect(mockMetro._subsystems.managers.stations.updateData).toHaveBeenCalledWith(currentData.stations);
        expect(mockMetro._subsystems.managers.lines.updateData).toHaveBeenCalledWith(currentData.lines);
        expect(mockMetro._subsystems.metroInfoProvider.updateData).toHaveBeenCalledWith(currentData);
        expect(mockMetro._combinedData).toBe(currentData);
        expect(mockMetro._safeEmit).toHaveBeenCalledWith(EventRegistry.RAW_DATA_PROCESSED, currentData);
        expect(mockMetro._safeEmit).toHaveBeenCalledWith(EventRegistry.DATA_UPDATED, currentData);
        expect(mockMetro._emitError).not.toHaveBeenCalled();
    });

    it('should throw an error if data is missing network field', async () => {
        const currentData = {
            version: '3.0.0',
            lines: {},
            stations: {}
        };

        await expect(dataEngine.handleRawData(currentData)).rejects.toThrow('Incoming data is missing network or version fields.');
        expect(mockMetro._subsystems.managers.stations.updateData).not.toHaveBeenCalled();
        expect(mockMetro._safeEmit).not.toHaveBeenCalled();
    });

    it('should throw an error if data is missing version field', async () => {
        const currentData = {
            network: { status: 'operational' },
            lines: {},
            stations: {}
        };

        await expect(dataEngine.handleRawData(currentData)).rejects.toThrow('Incoming data is missing network or version fields.');
        expect(mockMetro._subsystems.managers.stations.updateData).not.toHaveBeenCalled();
        expect(mockMetro._safeEmit).not.toHaveBeenCalled();
    });

    it('should throw an error for invalid data', async () => {
        await expect(dataEngine.handleRawData(null)).rejects.toThrow('Invalid currentData received');
        expect(mockMetro._emitError).not.toHaveBeenCalled();
    });

    it('should correctly expose the last processed data via getLastCombinedData', async () => {
        const currentData = {
            network: { status: 'operational', timestamp: new Date().toISOString() },
            version: '3.0.0',
            lines: { 'l1': { id: 'l1' } },
            stations: { 'st1': { id: 'st1' } }
        };

        await dataEngine.handleRawData(currentData);
        const lastData = dataEngine.getLastCombinedData();

        expect(lastData).toBe(currentData);
    });
});
