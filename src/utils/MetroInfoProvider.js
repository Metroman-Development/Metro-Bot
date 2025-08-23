// src/utils/MetroInfoProvider.js

class MetroInfoProvider {
    constructor() {
        this.metroData = {
            lines: {},
            network_status: {},
            stations: {},
            last_updated: null
        };
    }

    static getInstance() {
        if (!MetroInfoProvider.instance) {
            MetroInfoProvider.instance = new MetroInfoProvider();
        }
        return MetroInfoProvider.instance;
    }

    /**
     * Updates the data in the provider.
     * @param {object} newData - The new, full, processed metro data object.
     */
    updateData(newData) {
        this.metroData = newData || {
            lines: {},
            network_status: {},
            stations: {},
            last_updated: null
        };
    }

    /**
     * Updates the data from the API.
     * @param {object} apiData - The data fetched from the API.
     * @param {object} timeHelpers - The time helpers instance.
     */
    updateFromApi(apiData, timeHelpers) {
        const currentData = this.getFullData();
        const apiLastChange = new Date(apiData.lastSuccessfulFetch);
        const dbLastChange = new Date(currentData.last_updated);

        if (apiLastChange > dbLastChange) {
            currentData.lines = apiData.lineas;
            currentData.network_status = apiData.network;
            this.updateData(currentData);
        }
    }

    /**
     * Updates the data from the database.
     * @param {object} dbData - The data fetched from the database.
     * @param {object} timeHelpers - The time helpers instance.
     */
    updateFromDb(dbData, timeHelpers) {
        const currentData = this.getFullData();

        for (const stationId in dbData.stations) {
            if (!currentData.stations[stationId]) {
                currentData.stations[stationId] = {};
            }
            Object.assign(currentData.stations[stationId], dbData.stations[stationId]);
        }

        for (const lineId in dbData.lines) {
            if (!currentData.lines[lineId]) {
                currentData.lines[lineId] = {};
            }
            Object.assign(currentData.lines[lineId], dbData.lines[lineId]);
        }

        currentData.last_updated = timeHelpers.currentTime;
        this.updateData(currentData);
    }

    /**
     * Gets all line data.
     * @returns {object} A map of line data.
     */
    getLines() {
        return this.metroData.lines;
    }

    /**
     * Gets all station data.
     * @returns {object} A map of station data.
     */
    getStations() {
        return this.metroData.stations;
    }

    /**
     * Gets the full dataset.
     * @returns {object} The full metro data object.
     */
    getFullData() {
        return this.metroData;
    }
}

module.exports = MetroInfoProvider.getInstance();
