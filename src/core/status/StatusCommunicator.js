const metro = require('../../metroSystems'); // Main metro system interface
const logger = require('../../events/logger');

class StatusCommunicator {
  static async fetchLiveStatus() {
    try {
      const data = await metro.getSystemStatus();
      logger.debug('Fetched live metro status');
      return data;
    } catch (error) {
      logger.error(`Metro API request failed: ${error.message}`);
      throw new Error('Failed to fetch metro status');
    }
  }

  static async getLineDetails(lineId) {
    try {
      return await metro.lines.getInfo(lineId);
    } catch (error) {
      logger.error(`Failed to get line ${lineId} details: ${error.message}`);
      return null;
    }
  }

  static async getStationStatus(stationId) {
    try {
      return await metro.stations.getStatus(stationId);
    } catch (error) {
      logger.error(`Failed to get station ${stationId} status: ${error.message}`);
      return null;
    }
  }
}

module.exports = StatusCommunicator;