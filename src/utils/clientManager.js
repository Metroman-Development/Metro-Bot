const { Client, GatewayIntentBits } = require('discord.js');

// Initialize the client object

let client = null;

/**

 * Set the client object explicitly.

 * @param {Client} newClient - The Discord client object.

 */

function setClient(newClient) {

    if (!newClient || !(newClient instanceof Client)) {

        throw new Error('Invalid client object provided.');

    }

    client = newClient;

    // Attach custom properties to the client object

  //  client.disambiguationData = new Map(); // Initialize disambiguation data storage

    // client.helpData = new Map(); // Initialize help data storage

  //  client.stationData = new Map(); // Initialize station data storage

    // Load additional utilities

//const lineUtils = require('./lineUtils'); // Import lineUtils

   // const searchUtils = r//equire('./searchUtils'); // Import searchUtils

   // const stationUtils = require('./stationUtils'); // Import stationUtils

   // client.lineUtils = lineUtils; // Attach lineUtils to the client

  //  client.searchUtils = searchUtils; // Attach searchUtils to the client

   // client.stationUtils = stationUtils; // Attach stationUtils to the client

}

/**

 * Get the client object.

 * @returns {Client} - The cached Discord client object.

 */

function getClient() {

    if (!client) {

        throw new Error('Client has not been initialized. Call setClient() first.');

    }

    return client;

}

module.exports = { setClient, getClient };