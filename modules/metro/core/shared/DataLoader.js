const apiService = require('../services/apiService');
const dbService = require('../services/dbService');

module.exports = async () => {
  try {
    const [apiData, dbData] = await Promise.all([
      apiService.fetchNetworkStatus(),
      dbService.getLatestNetworkState()
    ]);
    
    return dbData || apiService.transformAPIData(apiData);
  } catch (error) {
    return apiService.generateClosedState();
  }
};