const ApiResponseTransformer = require('../src/core/metro/core/shared/transformers/ApiResponseTransformer');

describe('ApiResponseTransformer', () => {
  describe('transform', () => {
    it('should correctly transform the API response', () => {
      const apiData = {
        'L1': {
          'status': '1',
          'stations': [
            {
              'code': 'P1',
              'name': 'Station 1',
              'status': '1',
              'transfer': 'L2',
              'servicios': 'service1, service2'
            }
          ]
        },
        'L2': {
          'status': '0',
          'stations': [
            {
              'code': 'P2',
              'name': 'Station 2',
              'status': '0',
              'transfer': null,
              'servicios': null
            }
          ]
        },
        'L3': {
            'status': '99',
            'stations': []
        }
      };

      const transformedData = ApiResponseTransformer.transform(apiData);

      // Test line 1
      expect(transformedData.lines.l1).toBeDefined();
      expect(transformedData.lines.l1.id).toBe('l1');
      expect(transformedData.lines.l1.name).toBe('Línea L1');
      expect(transformedData.lines.l1.status).toBe('operational');
      expect(transformedData.lines.l1.stations).toEqual(['p1']);

      // Test station 1
      expect(transformedData.stations.p1).toBeDefined();
      expect(transformedData.stations.p1.id).toBe('p1');
      expect(transformedData.stations.p1.code).toBe('P1');
      expect(transformedData.stations.p1.name).toBe('Station 1');
      expect(transformedData.stations.p1.line).toBe('l1');
      expect(transformedData.stations.p1.status).toBe('operational');
      expect(transformedData.stations.p1.transfers).toEqual({ l2: true });

      // Test line 2
      expect(transformedData.lines.l2).toBeDefined();
      expect(transformedData.lines.l2.id).toBe('l2');
      expect(transformedData.lines.l2.name).toBe('Línea L2');
      expect(transformedData.lines.l2.status).toBe('closed');
      expect(transformedData.lines.l2.stations).toEqual(['p2']);

      // Test station 2
      expect(transformedData.stations.p2).toBeDefined();
      expect(transformedData.stations.p2.id).toBe('p2');
      expect(transformedData.stations.p2.code).toBe('P2');
      expect(transformedData.stations.p2.name).toBe('Station 2');
      expect(transformedData.stations.p2.line).toBe('l2');
      expect(transformedData.stations.p2.status).toBe('closed');
      expect(transformedData.stations.p2.transfers).toEqual({});

      // Test line 3 (unknown status)
      expect(transformedData.lines.l3).toBeDefined();
      expect(transformedData.lines.l3.id).toBe('l3');
      expect(transformedData.lines.l3.name).toBe('Línea L3');
      expect(transformedData.lines.l3.status).toBe('unknown');
    });
  });
});
