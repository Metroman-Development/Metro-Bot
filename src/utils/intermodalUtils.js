// intermodalUtils.js

// Import the JSON files
const intermodalInfo = require('../data/intermodalInfo.json');
const intermodalBuses = require('../data/intermodalBuses.json');

// Function to perform a full merge of the data
function mergeData(infoData, busesData) {
    const mergedData = {};

    // Iterate over each location in the infoData
    for (const location in infoData) {
        mergedData[location] = {

            Nombre:location,

            ...infoData[location], // Spread the existing infoData
            Recorridos: busesData[location] || [] // Add the buses data (if available)
        };
    }

    // Handle locations that are only in busesData but not in infoData
    for (const location in busesData) {
        if (!mergedData[location]) {
            mergedData[location] = {
                Servicios: [], // Default empty array for servicios
                ...busesData[location] // Add the buses data
            };
        }
    }

    //console.log(mergedData) ;

    return mergedData;
}

// Perform the full merge
const intermodalData = mergeData(intermodalInfo, intermodalBuses);

// Export the merged data as "Intermodal Data"
module.exports = intermodalData;
