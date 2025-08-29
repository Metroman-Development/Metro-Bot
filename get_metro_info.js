const DatabaseManager = require('./src/core/database/DatabaseManager');
const MetroInfoProvider = require('./src/utils/MetroInfoProvider');
const ApiService = require('./src/core/metro/core/services/ApiService');
const config = require('./src/config/metro/metroConfig');

async function main() {
  try {
    const dbConfig = {
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'metroapi',
      password: process.env.DB_PASSWORD || 'Metro256',
      database: process.env.METRODB_NAME || 'MetroDB',
    };

    const dbManager = await DatabaseManager.getInstance(dbConfig);
    const databaseService = await require('./src/core/database/DatabaseService').getInstance(dbManager);

    const metroCore = {
      _subsystems: {
        databaseService: databaseService,
      }
    };

    const metroInfoProvider = MetroInfoProvider.initialize(metroCore, databaseService);
    metroCore._subsystems.metroInfoProvider = metroInfoProvider;

    const apiService = new ApiService(metroCore, { dbService: databaseService, config: config }, {
        handleRawData: (data) => data,
    });

    const data = await apiService.fetchNetworkStatus();

    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    // We need to exit the process because the database manager is holding it open.
    process.exit();
  }
}

main();
