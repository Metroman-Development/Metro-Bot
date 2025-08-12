/**
 * @module fetchData
 * @description Provides a function to fetch station data from a JSON file.
 */

const path = require('path');
const loadJsonFile = require('../utils/jsonLoader');

/**
 * Synchronously fetches the station data from the JSON file.
 * @returns {object} The parsed station data.
 * @throws {Error} If the file cannot be read or parsed.
 */
function getStationsData() {
    const jsonFilePath = path.resolve(__dirname, 'stationsData.json');
    console.log('Loading station data from:', jsonFilePath);

    try {
        const stationsDetails = loadJsonFile(jsonFilePath);
        return stationsDetails;
    } catch (error) {
        console.error('Error loading station data:', error);
        throw error; // Re-throw the error to be handled by the caller
    }
}

module.exports = {
    getStationsData
};
