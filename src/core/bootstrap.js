require('dotenv').config();
const fs = require('fs');
const path = require('path');
const logger = require('../events/logger');
const DatabaseManager = require('./database/DatabaseManager');
const MetroCore = require('./metro/core/MetroCore');

async function initialize(componentName) {
    logger.info(`[${componentName}] Initializing...`);

    let dbConfig;
    if (process.env.DB_HOST) {
        dbConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.METRODB_NAME,
            port: process.env.DB_PORT
        };
    } else {
        const configPath = path.join(__dirname, '../../config.json');
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
            logger.error(`[${componentName}] ❌ Database configuration not found. Please set environment variables or create a config.json file.`);
            process.exit(1);
        }
    }

    let metroCore;
    try {
        // Pass dbConfig to MetroCore, which will in turn initialize DatabaseManager
        metroCore = await MetroCore.getInstance({ dbConfig });
        logger.info(`[${componentName}] MetroCore and DatabaseManager initialized.`);
    } catch (error) {
        logger.error(`[${componentName}] ❌ Failed to initialize MetroCore or Database:`, { error });
        process.exit(1);
    }

    return { metroCore };
}

module.exports = initialize;
