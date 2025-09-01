const MetroInfoProvider = require('../src/utils/MetroInfoProvider');

describe('MetroInfoProvider', () => {
  let metroInfoProvider;
  let mockDatabaseService;

  beforeEach(() => {
    mockDatabaseService = {
      getLinesWithStatus: jest.fn().mockResolvedValue([]),
      getStationsWithStatus: jest.fn().mockResolvedValue([]),
      query: jest.fn().mockResolvedValue([]),
    };
    const mockMetroCore = {};
    metroInfoProvider = MetroInfoProvider.initialize(mockMetroCore, mockDatabaseService);
  });

  afterEach(() => {
    MetroInfoProvider.instance = null;
    jest.clearAllMocks();
  });

  describe('updateFromDb', () => {
    it('should fetch fused data from the database when no data is provided', async () => {
      const lines = [{ line_id: 'L1', line_name: 'Test Line', status_message: 'Operational' }];
      const stations = [{ station_id: 'ST1', station_name: 'Test Station', status_message: 'Operational' }];
      mockDatabaseService.getLinesWithStatus.mockResolvedValue(lines);
      mockDatabaseService.getStationsWithStatus.mockResolvedValue(stations);

      await metroInfoProvider.updateFromDb();

      expect(mockDatabaseService.getLinesWithStatus).toHaveBeenCalled();
      expect(mockDatabaseService.getStationsWithStatus).toHaveBeenCalled();
      expect(metroInfoProvider.data.lines.L1).toEqual(lines[0]);
      expect(metroInfoProvider.data.stations.ST1).toEqual(stations[0]);
    });

    it('should use provided data when dbData is provided', async () => {
      const dbData = {
        lines: [{ id: 'L1', name: 'Test Line' }],
        stations: [{ id: 'ST1', name: 'Test Station' }],
      };

      await metroInfoProvider.updateFromDb(dbData);

      expect(mockDatabaseService.getLinesWithStatus).not.toHaveBeenCalled();
      expect(mockDatabaseService.getStationsWithStatus).not.toHaveBeenCalled();
      expect(metroInfoProvider.data.lines.L1).toEqual({ id: 'L1', name: 'Test Line' });
      expect(metroInfoProvider.data.stations.ST1).toEqual({ id: 'ST1', name: 'Test Station' });
    });
  });

  describe('getStationDetails', () => {
    it('should return null for non-existent station', () => {
      metroInfoProvider.data.stations = {};
      expect(metroInfoProvider.getStationDetails('non-existent')).toBeNull();
    });

    it('should return fused station details', () => {
      const stationName = 'Test Station';
      const stationData = {
        'test-station': {
          station_name: 'Test Station',
          line_id: 'L1',
          route_color: 'R',
          express_state: 'Operational',
          combinacion: 'L2',
          connections: ['L2', 'bus'],
          access_details: 'details',
          services: 'services',
          accessibility: 'accessibility',
          amenities: 'amenities',
          commune: 'commune',
          platforms: { '1': 1, '2': 0 },
          status_message: 'Station is operational',
          status_name: 'operational',
          is_operational: 1,
          status_description: 'Station is operational'
        }
      };
      metroInfoProvider.updateData({
        stations: stationData,
        lines: { L1: { status_message: 'Line is operational' } },
        intermodal: { buses: { 'Test Station': ['bus1', 'bus2'] } }
      });

      const details = metroInfoProvider.getStationDetails(stationName);

      expect(details).toEqual({
        name: 'Test Station',
        line: 'L1',
        route: 'Roja',
        express_state: 'Operational',
        transfer: 'LL2',
        connections: ['L2', 'bus'],
        details: {
          schematics: 'details',
          services: 'services',
          accessibility: 'accessibility',
          amenities: 'amenities',
          municipality: 'commune',
        },
        platforms: [{ platform: 1, status: 'active' }, { platform: 2, status: 'inactive' }],
        intermodal: ['bus1', 'bus2'],
        status: expect.any(Object),
      });
    });
  });

  describe('getLine', () => {
    it('should return null for non-existent line', () => {
        metroInfoProvider.data.lines = {};
      expect(metroInfoProvider.getLine('non-existent')).toBeNull();
    });

    it('should return fused line details', () => {
      const lineId = 'L1';
      const lineData = {
        L1: {
          line_name: 'Test Line',
          status_message: 'Line is operational'
        }
      };
      metroInfoProvider.updateData({ lines: lineData });

      const details = metroInfoProvider.getLine(lineId);

      expect(details).toEqual({
        line_name: 'Test Line',
        status_message: 'Line is operational'
      });
    });
  });
});
