const { readdirSync } = require('fs');
const { join } = require('path');
const logger = require('../../events/logger.js');

module.exports = {
    loadButtons: (buttonsCollection) => {
        const buttonsPath = join(__dirname, '../../events/interactions/buttons/templates');
        let loadedCount = 0;

        readdirSync(buttonsPath).forEach(file => {
            if (!file.endsWith('.js')) return;
            
            try {
                const ButtonClass = require(join(buttonsPath, file));
                if (ButtonClass.prototype instanceof require('../../events/interactions/buttons/templates/baseButton.js')) {
                    const instance = new ButtonClass();
                    buttonsCollection.set(instance.constructor.name, instance);
                    loadedCount++;
                    
                    logger.debug(`Registered button: ${instance.constructor.name}`, {
                        prefix: instance.customIdPrefix,
                        file: file
                    });
                }
            } catch (error) {
                logger.error(`Failed to load button ${file}:`, error);
            }
        });

        return loadedCount;
    }
};