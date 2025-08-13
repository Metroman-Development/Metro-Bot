const apiService = require('../services/ApiService.js');
const dbService = require('../services/dbService.js');

module.exports = async () => {
  try {
    const [apiData, dbData] = await Promise.all([
      apiService.fetchNetworkStatus(),
      dbService.getLatestNetworkState()
    ]);
    
    return dbData || apiService._basicProcessData(apiData);
  } catch (error) {
    return apiService.generateClosedState();
  }
};