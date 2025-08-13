const fs = require('fs');
const path = require('path');
const logger = require('../../logger');

const buttonHandlers = new Map();

// Load all button handlers from subdirectories
const loadButtons = () => {
    const buttonsPath = path.join(__dirname);
    const buttonCategories = fs.readdirSync(buttonsPath).filter(file => 
        fs.lstatSync(path.join(buttonsPath, file)).isDirectory()
    );

    for (const category of buttonCategories) {
        const categoryPath = path.join(buttonsPath, category);
        const buttonFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));

        for (const file of buttonFiles) {
            const buttonModule = require(path.join(categoryPath, file));
            const handlers = Array.isArray(buttonModule) ? buttonModule : [buttonModule];
            
            handlers.forEach(handler => {
                if (handler.customId) {
                    buttonHandlers.set(handler.customId, handler);
                    logger.info(`✅ Loaded button handler: ${handler.customId}`);
                }
            });
        }
    }
};

const getButtonHandler = (customId) => {
    // Find handler where customId starts with the registered prefix
    for (const [prefix, handler] of buttonHandlers.entries()) {
        if (customId.startsWith(prefix)) {
            return handler;
        }
    }
    return null;
};

module.exports = {
    loadButtons,
    getButtonHandler,
    buttonHandlers
};