const DatabaseManager = require('./src/core/database/DatabaseManager');
const MetroInfoProvider = require('./src/utils/MetroInfoProvider');
const DataManager = require('./src/core/metro/core/services/DataManager');
const config = require('./src/config/metro/metroConfig');

async function main() {
  try {
    console.log('Waiting for database to be ready...');
    // Wait for the database to be ready
    await new Promise(resolve => setTimeout(resolve, 30000));
    console.log('Attempting to connect to the database...');
    const dbConfig = {
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'metroapi',
      password: process.env.DB_PASSWORD || 'Metro256',
      database: process.env.METRODB_NAME || 'MetroDB',
    };

    const dbManager = await DatabaseManager.getInstance(dbConfig);
    console.log('Database manager instance created.');
    const databaseService = await require('./src/core/database/DatabaseService').getInstance(dbManager);

    const metroCore = {
      _subsystems: {
        databaseService: databaseService,
      }
    };

    const metroInfoProvider = MetroInfoProvider.initialize(metroCore, databaseService);
    metroCore._subsystems.metroInfoProvider = metroInfoProvider;

    const dataManager = new DataManager(metroCore, { dbService: databaseService, config: config }, {
        handleRawData: (data) => data,
    });

    const data = await dataManager.fetchNetworkStatus();

    console.log(JSON.stringify(metroInfoProvider.getFullData(), null, 2));

  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    // We need to exit the process because the database manager is holding it open.
    process.exit();
  }
}

main();
