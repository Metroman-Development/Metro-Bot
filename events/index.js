const fs = require('fs');
const path = require('path');
const logger = require('./logger');

module.exports = (client) => {
    const eventsPath = path.join(__dirname, 'Discord');
    const eventFiles = fs.readdirSync(eventsPath)
        .filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
        
        logger.debug('EVENT_LOADED', `Registered ${event.name} handler`);
    }
};