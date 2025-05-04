const fs = require('fs');
const path = require('path');
const logger = require('./logger');

module.exports = (client) => {
    try {
        const eventsPath = path.join(__dirname, 'Discord');
        
        // Verify events directory exists
        if (!fs.existsSync(eventsPath)) {
            throw new Error(`Events directory not found: ${eventsPath}`);
        }

        // Read directory with error handling
        let eventFiles;
        try {
            eventFiles = fs.readdirSync(eventsPath)
                .filter(file => file.endsWith('.js'));
            
            if (eventFiles.length === 0) {
                logger.warn('NO_EVENTS_FOUND', `No event files found in ${eventsPath}`);
            }
        } catch (readError) {
            throw new Error(`Failed to read events directory: ${readError.message}`);
        }

        for (const file of eventFiles) {
            const filePath = path.join(eventsPath, file);
            
            try {
                // Validate file exists (though readdirSync should have confirmed this)
                if (!fs.existsSync(filePath)) {
                    logger.warn('MISSING_EVENT_FILE', `Event file disappeared: ${filePath}`);
                    continue;
                }

                // Load event module
                let event;
                try {
                    event = require(filePath);
                } catch (moduleError) {
                    throw new Error(`Failed to require event file ${filePath}: ${moduleError.message}`);
                }

                // Validate event structure
                if (!event.name || typeof event.execute !== 'function') {
                    throw new Error(`Invalid event structure in ${filePath} - missing name or execute function`);
                }

                // Register event with error wrapping
                const handler = (...args) => {
                    try {
                        return event.execute(...args);
                    } catch (executionError) {
                        logger.error('EVENT_HANDLER_ERROR', {
                            event: event.name,
                            error: executionError.message,
                            stack: executionError.stack
                        });
                        
                        // For critical events, you might want to rethrow or handle differently
                        if (event.critical) {
                            throw executionError;
                        }
                    }
                };

                if (event.once) {
                    client.once(event.name, handler);
                } else {
                    client.on(event.name, handler);
                }
                
                logger.debug('EVENT_LOADED', `Registered ${event.name} handler`);

            } catch (fileError) {
                logger.error('EVENT_LOAD_FAILED', {
                    file: filePath,
                    error: fileError.message
                });
                // Continue loading other events even if one fails
                continue;
            }
        }
    } catch (globalError) {
        logger.error('EVENT_LOADER_FAILED', {
            error: globalError.message,
            stack: globalError.stack
        });
        // Depending on your application, you might want to:
        // - Exit the process if events are critical
        // - Or continue with partial functionality
        process.exit(1);
    }
};
