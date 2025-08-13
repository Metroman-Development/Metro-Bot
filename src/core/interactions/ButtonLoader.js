const { readdirSync } = require('fs');
const { join } = require('path');
const logger = require('./logger');

module.exports = {
    loadButtons: (buttonsCollection) => {
        const buttonsPath = join(__dirname, 'buttons', 'templates');
        let loadedCount = 0;

        readdirSync(buttonsPath).forEach(file => {
            if (!file.endsWith('.js')) return;
            
            try {
                const ButtonClass = require(join(buttonsPath, file));
                if (ButtonClass.prototype instanceof require('./buttons/templates/BaseButton')) {
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