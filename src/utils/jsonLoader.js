/**
 * @module jsonLoader
 * @description Provides a centralized, robust utility for loading and parsing JSON files.
 */

const fs = require('fs');
const path = require('path');

/**
 * Loads and parses a JSON file with detailed error handling.
 * @param {string} filePath - The relative path to the JSON file.
 * @returns {object} The parsed JSON object.
 * @throws {Error} If the file does not exist or contains invalid JSON, with a path-specific error message.
 */
function loadJsonFile(filePath) {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`JSON load error: File not found at '${absolutePath}'.`);
    }

    try {
        const fileContent = fs.readFileSync(absolutePath, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error) {
        throw new Error(`JSON parse error in file '${absolutePath}': ${error.message}`);
    }
}

module.exports = loadJsonFile;
