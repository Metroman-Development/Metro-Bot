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
        { line_id: 'L1', line_name: 'Test Line 1', display_name: 'Test Line 1', line_color: '#FF0000', status_message: 'Operational', status_code: 1, app_message: 'App message', express_status: 'active' }
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
      expect(station.nombre).toEqual('Test Station 1');
      expect(station.codigo).toEqual('ST1');
      expect(station.estado).toEqual('1');
      expect(station.combinacion).toEqual('L2');
      expect(station.descripcion).toEqual('Operational');
      expect(station.descripcion_app).toEqual('All good');
      expect(station.station_id).toEqual(1);
      expect(station.line_id).toEqual('l1');
      expect(station.commune).toEqual('Test Commune');
      expect(station.accessibility).toEqual('Ascensor ABC\\nEscalator XYZ');
      expect(station.status_data).toBeDefined();
      expect(station.status_data.status_name).toEqual('operational');
      expect(station.status_data.is_operational).toEqual(1);
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
          combinacion: 'L2',
          connections: ['L2', 'bus'],
          access_details: 'details',
          services: 'services',
          accessibility: 'Ascensor ABC (Disponible)\\nEscalator XYZ (No disponible)',
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
          accessibility: 'Ascensor ABC (Disponible)\\nEscalator XYZ (No disponible)',
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
