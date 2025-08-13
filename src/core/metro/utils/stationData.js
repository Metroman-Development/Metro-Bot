const path = require('path');
const fs = require('fs');

const STATIONS_DATA_PATH = path.join(__dirname, '../../../data/stations.json');
const STATIONS_DETAILS_PATH = path.join(__dirname, '../../../data/stationsData.json');

async function loadStationData() {
  try {
    const [stations, details] = await Promise.all([
      readJsonFile(STATIONS_DATA_PATH),
      readJsonFile(STATIONS_DETAILS_PATH)
    ]);

    return {
      stations,
      details: {
        data: details.stationsData,
        schematics: details.stationsSchematics
      }
    };
  } catch (error) {
    throw new Error(`Failed to load station data: ${error.message}`);
  }
}

function readJsonFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) return reject(err);
      try {
        resolve(JSON.parse(data));
      } catch (parseErr) {
        reject(parseErr);
      }
    });
  });
}

function getStationDetails(stationName, lineId) {
  // Implementation would use the loaded data
  // This is just a placeholder structure
  return {
    services: [],
    accessibility: 'Full',
    schematics: null,
    municipality: 'Unknown'
  };
}

module.exports = {
  loadStationData,
  getStationDetails
};