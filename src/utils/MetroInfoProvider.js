// src/utils/MetroInfoProvider.js

class MetroInfoProvider {
    constructor() {
        this.data = { lines: {}, stations: {} };
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
        this.data = newData || { lines: {}, stations: {} };
    }

    /**
     * Gets all line data.
     * @returns {object} A map of line data.
     */
    getLines() {
        return this.data.lines;
    }

    /**
     * Gets all station data.
     * @returns {object} A map of station data.
     */
    getStations() {
        return this.data.stations;
    }

    /**
     * Gets the full dataset.
     * @returns {object} The full metro data object.
     */
    getFullData() {
        return this.data;
    }
}

module.exports = MetroInfoProvider.getInstance();
