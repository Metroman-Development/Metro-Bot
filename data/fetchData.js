const fs = require('fs');

const path = require('path');

// Function to fetch the data from the JSON file

function getStationsData(callback) {

    // Absolute path to the JSON file

    const jsonFilePath = path.resolve(__dirname, 'stationsData.json');

    console.log('Resolved JSON file path:', jsonFilePath); // Log the resolved path

    // Read the JSON file

    fs.readFile(jsonFilePath, 'utf8', (err, data) => {

        if (err) {

            console.error('Error reading JSON file:', err); // Log the error

            return callback(err, null);

        }

        try {

            // Parse the JSON data

            const stationsDetails = JSON.parse(data);

            

            // Call the callback with the parsed data

            callback(null, stationsDetails);

        } catch (parseError) {

            console.error('Error parsing JSON data:', parseError); // Log JSON parsing errors

            callback(parseError, null);

        }

    });

}

// Export the function for use in other modules

module.exports = {

    getStationsData

};