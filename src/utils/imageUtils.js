/**
 * @file imageUtils.js
 * @description Utilities for processing images.
 */

const ImageProcessor = require('./imageProcessor');

/**
 * Processes an image for Discord.
 * @param {string} imageUrl The URL of the image to process.
 * @param {object} options The options for processing the image.
 * @returns {Promise<AttachmentBuilder>} A promise that resolves to a Discord attachment.
 */
async function processImageForDiscord(imageUrl, options) {
    try {
        return await ImageProcessor.processForDiscord(imageUrl, options);
    } catch (error) {
        console.error(`Failed to process image ${imageUrl}:`, error);
        return null;
    }
}

module.exports = {
    processImageForDiscord,
};
