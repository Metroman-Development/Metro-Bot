/**
 * @file metroUtils.js
 * @description Utilities for handling Metro-related data and operations.
 */

const MetroCore = require('../core/metro/core/MetroCore');
const SearchCore = require('../core/metro/search/SearchCore');

/**
 * Retrieves or initializes the MetroCore instance.
 * @param {import('discord.js').Interaction} interaction The interaction object.
 * @returns {Promise<MetroCore>} The MetroCore instance.
 * @throws {Error} If the MetroCore instance cannot be initialized.
 */
async function getMetroCore(interaction) {
    try {
        // Check if the instance already exists and is initialized.
        if (!interaction.client.metroCore || !interaction.client.metroCore.api) {
            interaction.client.metroCore = await MetroCore.getInstance({
                client: interaction.client
            });
        }
        return interaction.client.metroCore;
    } catch (error) {
        console.error('Failed to initialize or retrieve MetroCore instance:', error);
        throw new Error('No se pudo conectar con el sistema de Metro. Por favor, inténtalo de nuevo más tarde.');
    }
}

/**
 * Searches for metro stations based on a query.
 * @param {MetroCore} metro The MetroCore instance.
 * @param {string} query The search query.
 * @returns {Promise<Array>} A promise that resolves to an array of station results.
 */
async function searchStations(metro, query) {
    const stationSearcher = new SearchCore('station');
    stationSearcher.setDataSource(metro.api.getProcessedData());
    return await stationSearcher.search(query.toLowerCase(), { maxResults: 25 });
}

const metroConfig = require('../config/metro/metroConfig');

function getLineColor(line) {
    return metroConfig.lineColors?.[line?.toLowerCase()] || 0x000000;
}

function getLineImage(line) {
    return `https://www.metro.cl/images/lines/line-${line || 'default'}.png`;
}

module.exports = {
    getMetroCore,
    searchStations,
    getLineColor,
    getLineImage,
};
