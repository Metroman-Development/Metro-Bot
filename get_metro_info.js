// get_metro_info.js

// Import the MetroInfoProvider directly
const MetroInfoProvider = require('./src/utils/MetroInfoProvider');

// Main function to run the script
function main() {
  try {
    // Get the full dataset from the MetroInfoProvider
    const metroData = MetroInfoProvider.getFullData();

    // Parse command-line arguments
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command) {
      // If no command is provided, print a summary of the data
      console.log('No command provided. Printing summary of the data.');
      console.log(JSON.stringify({
        lines: Object.keys(metroData.lines).length,
        stations: Object.keys(metroData.stations).length,
        intermodal_stations: Object.keys(metroData.intermodal.stations).length,
        last_updated: metroData.last_updated,
        network_status: metroData.network_status,
      }, null, 2));
      return;
    }

    switch (command) {
      case 'lines':
        console.log(JSON.stringify(metroData.lines, null, 2));
        break;
      case 'stations':
        console.log(JSON.stringify(metroData.stations, null, 2));
        break;
      case 'intermodal':
        console.log(JSON.stringify(metroData.intermodal, null, 2));
        break;
      case 'find':
        const type = args[1];
        const name = args[2];
        if (type === 'station') {
          const station = MetroInfoProvider.getStationById(name);
          if (station) {
            console.log(JSON.stringify(station, null, 2));
          } else {
            console.log(`Station "${name}" not found.`);
          }
        } else {
          console.log('Invalid find command. Usage: find station <name>');
        }
        break;
      default:
        console.log(`Unknown command: ${command}`);
        console.log('Available commands: lines, stations, intermodal, find station <name>');
    }
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

// Run the main function
main();
