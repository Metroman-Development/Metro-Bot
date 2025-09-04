const { initialize } = require('./src/core/bootstrap');

async function main() {
  console.log('Starting verification script...');
  const { metroInfoProvider, databaseManager } = await initialize('VERIFICATION_SCRIPT');
  console.log('MetroInfoProvider and DatabaseManager initialized.');

  if (!metroInfoProvider) {
    console.error('MetroInfoProvider initialization failed.');
    process.exit(1);
  }

  const provider = metroInfoProvider;

  const stationName = 'San Pablo L1';
  const stationInfo = provider.getStationById(stationName);

  if (stationInfo) {
    console.log(`Station Info for ${stationName}:`);
    console.log(JSON.stringify(stationInfo, null, 2));
    if (stationInfo.connections && Array.isArray(stationInfo.connections) && stationInfo.connections.includes('l5')) {
      console.log('SUCCESS: Connections data is correctly passed.');
    } else {
      console.error('FAILURE: Connections data is missing or incorrect.');
      console.error('Expected connections to include "l5". Received:', stationInfo.connections);
    }
  } else {
    console.error(`Station ${stationName} not found.`);
  }

  // Clean up the database connection
  await databaseManager.close();
}

main().catch(err => {
    console.error('Unhandled error in main:', err);
    process.exit(1); // Exit with error code
});
