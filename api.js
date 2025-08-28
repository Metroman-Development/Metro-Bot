// Patch BigInt serialization
BigInt.prototype.toJSON = function() {
    return this.toString();
};

const path = require('path');
const fs = require('fs');
const logger = require('./src/events/logger');
const DatabaseManager = require('./src/core/database/DatabaseManager');
const express = require('express');
const botRoutes = require('./src/utils/expressRoutes');

async function main() {
    console.log('[API] Initializing API server...');

    let dbConfig;
    // Environment variables take precedence
    if (process.env.DB_HOST) {
        dbConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.METRODB_NAME,
        };
    } else {
        // Fallback to config.json
        const configPath = path.join(__dirname, 'config.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            dbConfig = {
                host: config.DB_HOST,
                user: config.DB_USER,
                password: config.DB_PASSWORD,
                database: config.METRODB_NAME,
                port: config.DB_PORT
            };
        } else {
            logger.error(`[API] ❌ Database configuration not found. Please set environment variables or create config.json.`);
            process.exit(1);
        }
    }

    // Initialize DatabaseManager
    try {
        await DatabaseManager.getInstance(dbConfig, { componentName: 'API' });
        logger.info('[API] ✅ DatabaseManager initialized successfully.');
    } catch (error) {
        logger.error('[API] ❌ Failed to initialize DatabaseManager:', error);
        process.exit(1);
    }

    // Setup Express app
    const app = express();
    const port = process.env.API_PORT || 3000;

    // Middleware to handle JSON payloads
    app.use(express.json());

    // A simple function to pass to routes if they need to send messages
    // to other components (currently a no-op in this standalone server)
    const sendMessage = (target, payload) => {
        logger.info(`[API] sendMessage called, but this is a standalone server. Target: ${target}, Payload: ${JSON.stringify(payload)}`);
    };
    app.set('sendMessage', sendMessage);

    // Register routes
    app.use('/bot', botRoutes);

    // Start server
    app.listen(port, () => {
        logger.info(`[API] ✅ API server listening on port ${port}`);
    });
}

main().catch(error => {
    logger.error('[API] ❌ Critical error during startup:', error);
    process.exit(1);
});
