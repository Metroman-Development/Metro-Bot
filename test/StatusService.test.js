const StatusService = require('../src/core/status/StatusService');
const EventEmitter = require('events');

describe('StatusService', () => {
  let statusService;

  beforeEach(() => {
    statusService = new StatusService();
  });

  describe('getLineStatus', () => {
    it('should return line not found for a non-existent line', () => {
      const lineStatus = statusService.getLineStatus('l7');
      expect(lineStatus.exists).toBe(false);
      expect(lineStatus.status.message).toBe('Line not found');
    });
  });

  describe('getStationStatus', () => {
    it('should return unknown status for a non-existent station', () => {
      const stationStatus = statusService.getStationStatus('l1-nonexistent');
      expect(stationStatus.status).toBe('unknown');
    });
  });

  describe('getNetworkStatus', () => {
    it('should return the initial network status', () => {
      const networkStatus = statusService.getNetworkStatus();
      expect(networkStatus.status).toBe('operational');
      expect(networkStatus.severity).toBe('low');
    });
  });
});
