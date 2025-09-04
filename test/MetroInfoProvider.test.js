const { MetroInfoProvider, STATIONS_QUERY } = require('../src/utils/MetroInfoProvider');

describe('MetroInfoProvider', () => {
  let metroInfoProvider;
  let mockDatabaseService;

  beforeEach(() => {
    mockDatabaseService = {
      query: jest.fn().mockResolvedValue([]),
    };
    metroInfoProvider = new MetroInfoProvider(mockDatabaseService);
  });

  afterEach(() => {
    MetroInfoProvider.instance = null;
    jest.clearAllMocks();
  });

  describe('updateFromDb', () => {
    it('should fetch and transform data from the database into the new station structure', async () => {
      const mockLines = [
        {
          line_id: 'L1',
          line_name: 'Test Line 1',
          display_name: 'Test Line 1',
          line_color: '#FF0000',
          status_message: 'Operational',
          status_code: 1,
          app_message: 'App message',
          express_status: 'active',
          line_description: 'Test Description',
          opening_date: '2025-01-01',
          total_stations: 10,
          total_length_km: 20.5,
          avg_daily_ridership: 100000,
          operating_hours_start: '06:00:00',
          operating_hours_end: '23:00:00',
          fleet_data: '[]',
          infrastructure: '{}',
          platform_details: '{}',
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z',
          status_id: 1,
          status_type_id: 1,
          status_description: 'Operational',
          expected_resolution_time: null,
          is_planned: 0,
          impact_level: 'none',
          status_last_updated: '2025-01-01T00:00:00.000Z',
          updated_by: 'system',
          status_name: 'operational',
          is_operational: 1,
          operational_status_desc: 'Operational'
        }
      ];
      const mockStations = [
        {
          station_id: 1,
          line_id: 'L1',
          station_code: 'ST1',
          station_name: 'Test Station 1',
          display_name: 'Station 1',
          display_order: 1,
          commune: 'Test Commune',
          address: 'Test Address',
          latitude: -33.4,
          longitude: -70.6,
          location: null,
          opened_date: '2025-01-01',
          last_renovation_date: '2025-01-01',
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z',
          transports: '["bus"]',
          services: '["atm"]',
          accessibility_text: 'Test accessibility',
          commerce: '["shop"]',
          amenities: '["wifi"]',
          image_url: 'http://example.com/image.png',
          access_details: '[]',
          combinacion: 'L2',
          connections: '["L2"]',
          express_state: 'active',
          route_color: 'R',
          status_id: 1,
          status_type_id: 1,
          status_description: 'Operational',
          status_message: 'All good',
          expected_resolution_time: null,
          is_planned: 0,
          impact_level: 'none',
          last_updated: '2025-01-01T00:00:00.000Z',
          updated_by: 'system',
          status_name: 'operational',
          is_operational: 1,
          operational_status_desc: 'Operational',
          js_code: '1',
          accessibility_statuses: 'ascensor|Ascensor ABC|1;escalator|Escalator XYZ|0',
        }
      ];
      const mockEvents = [];

      mockDatabaseService.query
        .mockResolvedValueOnce(mockLines)
        .mockResolvedValueOnce(mockStations)
        .mockResolvedValueOnce(mockEvents);

      await metroInfoProvider.updateFromDb();

      expect(mockDatabaseService.query).toHaveBeenCalledWith(STATIONS_QUERY);

      const station = metroInfoProvider.data.stations.ST1;
      expect(station).toBeDefined();
      expect(station.name).toEqual('Test Station 1');
      expect(station.code).toEqual('ST1');
      expect(station.status).toEqual('1');
      expect(station.transfer).toEqual('L2');
      expect(station.description).toEqual('Operational');
      expect(station.app_description).toEqual('All good');
      expect(station.station_id).toEqual(1);
      expect(station.line_id).toEqual('l1');
      expect(station.commune).toEqual('Test Commune');
      expect(station.accessibility).toEqual([
        { type: 'ascensor', text: 'Ascensor ABC', status: '1' },
        { type: 'escalator', text: 'Escalator XYZ', status: '0' }
      ]);
      expect(station.status_data).toBeDefined();
      expect(station.status_data.status_name).toEqual('operational');
      expect(station.status_data.is_operational).toEqual(1);

      const line = metroInfoProvider.data.lines.l1;
      expect(line).toBeDefined();
      expect(line.name).toEqual('Test Line 1');
      expect(line.color).toEqual('#FF0000');
      expect(line.status.code).toEqual(1);
      expect(line.line_description).toEqual('Test Description');
      expect(line.total_stations).toEqual(10);
      expect(line.status_data).toBeDefined();
      expect(line.status_data.status_name).toEqual('operational');
      expect(line.status_data.is_operational).toEqual(1);
    });
  });

  describe('getStationDetails', () => {
    it('should return null for non-existent station', () => {
      metroInfoProvider.data.stations = {};
      expect(metroInfoProvider.getStationDetails('non-existent')).toBeNull();
    });

    it('should return fused station details from the new station structure', () => {
      const stationName = 'Test Station';
      const stationData = {
          name: 'Test Station',
          line_id: 'L1',
          transfer: 'L2',
          connections: ['L2', 'bus'],
          access_details: 'details',
          services: 'services',
          accessibility: [
            { type: 'ascensor', text: 'Ascensor ABC', status: '1' },
            { type: 'escalator', text: 'Escalator XYZ', status: '0' }
          ],
          amenities: 'amenities',
          commune: 'commune',
          platforms: { '1': 1, '2': 0 },
          status_data: {
            status_message: 'Station is operational',
            status_name: 'operational',
            is_operational: true,
            status_description: 'Station is operational'
          }
      };
      metroInfoProvider.data.stations['test-station'] = stationData;
      metroInfoProvider.data.intermodal = { buses: { 'Test Station': ['bus1', 'bus2'] } };

      const details = metroInfoProvider.getStationDetails(stationName);

      expect(details).toEqual({
        name: 'Test Station',
        line: 'L1',
        transfer: 'L2',
        connections: ['L2', 'bus'],
        details: {
          schematics: 'details',
          services: 'services',
          accessibility: [
            { type: 'ascensor', text: 'Ascensor ABC', status: '1' },
            { type: 'escalator', text: 'Escalator XYZ', status: '0' }
          ],
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
});
