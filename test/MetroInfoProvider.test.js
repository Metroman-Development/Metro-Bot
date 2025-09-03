const { MetroInfoProvider, STATIONS_QUERY } = require('../src/utils/MetroInfoProvider');

describe('MetroInfoProvider', () => {
  let metroInfoProvider;
  let mockDatabaseService;

  beforeEach(() => {
    mockDatabaseService = {
      getLinesWithStatus: jest.fn().mockResolvedValue([]),
      getStationsWithStatus: jest.fn().mockResolvedValue([]),
      query: jest.fn().mockResolvedValue([]),
    };
    metroInfoProvider = new MetroInfoProvider(mockDatabaseService);
  });

  afterEach(() => {
    MetroInfoProvider.instance = null;
    jest.clearAllMocks();
  });

  describe('updateFromDb', () => {
    it('should fetch and transform data from the database', async () => {
      const mockLines = [
        { line_id: 'L1', line_name: 'Test Line 1', display_name: 'Test Line 1', line_color: '#FF0000', status_message: 'Operational', status_code: 1, app_message: 'App message', express_status: 'active' }
      ];
      const mockStations = [
        { station_code: 'ST1', station_name: 'Test Station 1', display_name: 'Station 1', line_id: 'L1', commune: 'Test Commune', transports: '["bus"]', services: '[]', commerce: '[]', amenities: '[]', image_url: '', accessibility: '[]', access_details: '[]', opened_date: '', last_renovation_date: '', combinacion: false, status_description: 'Operational', status_message: 'All good', is_planned: false, impact_level: 0, status_code: 'operational', is_operational: 1 }
      ];
      const mockEvents = [];

      // Mock the calls to databaseService.query
      mockDatabaseService.query
        .mockResolvedValueOnce(mockLines) // for loadLinesFromDb
        .mockResolvedValueOnce(mockStations) // for loadStationsFromDb
        .mockResolvedValueOnce(mockEvents); // for fetchAndSetEventData

      await metroInfoProvider.updateFromDb();

      // Check if query was called for lines, stations, and events
      expect(mockDatabaseService.query).toHaveBeenNthCalledWith(1, 'SELECT * FROM metro_lines');
      expect(mockDatabaseService.query).toHaveBeenNthCalledWith(2, STATIONS_QUERY);
      expect(mockDatabaseService.query).toHaveBeenNthCalledWith(3, 'SELECT * FROM metro_events WHERE is_active = 0 AND event_date >= CURDATE()');

      // Check the transformed line data
      expect(metroInfoProvider.data.lines.l1).toEqual({
        id: 'l1',
        name: 'Test Line 1',
        displayName: 'Test Line 1',
        color: '#FF0000',
        app_message: 'App message',
        express_status: 'active',
        status: { message: 'Operational', code: 1 }
      });

      // Check the transformed station data
      expect(metroInfoProvider.data.stations.ST1).toBeDefined();
      expect(metroInfoProvider.data.stations.ST1.name).toEqual('Test Station 1');
      expect(metroInfoProvider.data.stations.ST1.line).toEqual('l1');
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
          name: 'Test Station',
          line: 'L1',
          transfer: 'L2',
          connections: ['L2', 'bus'],
          accessDetails: 'details',
          services: 'services',
          accessibility: 'accessibility',
          amenities: 'amenities',
          commune: 'commune',
          platforms: { '1': 1, '2': 0 },
          status: {
            message: 'Station is operational',
            code: 'operational',
            isOperational: true,
            description: 'Station is operational'
          }
        }
      };
      metroInfoProvider.updateData({
        stations: stationData,
        lines: { L1: { status: { message: 'Line is operational' } } },
        intermodal: { buses: { 'Test Station': ['bus1', 'bus2'] } }
      });

      const details = metroInfoProvider.getStationDetails(stationName);

      expect(details).toEqual({
        name: 'Test Station',
        line: 'L1',
        transfer: 'L2',
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
        status: {
            code: 'operational',
            message: 'Station is operational',
            state: 'operational',
            description: 'Station is operational'
        },
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
