// Patch BigInt serialization
BigInt.prototype.toJSON = function() {
    return this.toString();
};

require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('./events/logger');
const DatabaseManager = require('./core/database/DatabaseManager');

const childProcesses = new Map();
const activeTransactions = new Map(); // For managing transaction connections

async function main() {
    console.log('[Master] Initializing master process...'); // Use console.log for first message

    let dbConfig;
    if (process.env.DB_HOST) {
        dbConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.METRODB_NAME,
        };
    } else {
        const configPath = path.join(__dirname, '../config.json');
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
            logger.error(`[Master] ❌ Database configuration not found.`);
            process.exit(1);
        }
    }

    const dbManager = await DatabaseManager.getInstance(dbConfig, { componentName: 'Master' });
    logger.info('[Master] ✅ DatabaseManager initialized successfully.');

    const components = [
        { name: 'DiscordBot', path: './discord-bot.js' },
        { name: 'TelegramBot', path: './telegram-bot.js' },
        { name: 'Scheduler', path: './scheduler.js' },
    ];

    function startComponent(component) {
        const componentPath = path.join(__dirname, component.path);
        const childProcess = spawn('node', [componentPath], {
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
            env: { ...process.env, IS_WORKER_PROCESS: 'true' }
        });

        childProcesses.set(component.name, childProcess);

        childProcess.stdout.pipe(process.stdout);
        childProcess.stderr.pipe(process.stderr);

        // IPC Handler
        childProcess.on('message', async (message) => {
            const { type, queryId, txId, sql, params } = message;
            let connection;

            try {
                switch (type) {
                    case 'db-query':
                        const result = await dbManager.query(sql, params);
                        childProcess.send({ type: 'db-result', queryId, result });
                        break;

                    case 'db-transaction-begin':
                        if (activeTransactions.has(txId)) {
                            throw new Error(`Transaction ${txId} already exists.`);
                        }
                        connection = await dbManager.pool.getConnection();
                        await connection.beginTransaction();
                        activeTransactions.set(txId, connection);
                        childProcess.send({ type: 'db-transaction-begun', txId });
                        break;

                    case 'db-transaction-query':
                        connection = activeTransactions.get(txId);
                        if (!connection) throw new Error(`Transaction ${txId} not found.`);
                        const txResult = await connection.query(sql, params);
                        childProcess.send({ type: 'db-result', queryId, result: txResult });
                        break;

                    case 'db-transaction-commit':
                        connection = activeTransactions.get(txId);
                        if (!connection) throw new Error(`Transaction ${txId} not found.`);
                        await connection.commit();
                        activeTransactions.delete(txId);
                        if (connection) connection.release();
                        childProcess.send({ type: 'db-transaction-committed', txId });
                        break;

                    case 'db-transaction-rollback':
                        connection = activeTransactions.get(txId);
                        if (!connection) throw new Error(`Transaction ${txId} not found.`);
                        await connection.rollback();
                        activeTransactions.delete(txId);
                        if (connection) connection.release();
                        childProcess.send({ type: 'db-transaction-rolled-back', txId });
                        break;
                }
            } catch (error) {
                const simplifiedError = { message: error.message, code: error.code };
                // Check if it's a query within a transaction or a regular query
                if (queryId !== undefined) {
                    childProcess.send({ type: 'db-error', queryId, error: simplifiedError });
                }
                // Handle transaction lifecycle errors (begin, commit, rollback)
                else if (txId !== undefined) {
                    childProcess.send({ type: 'db-transaction-error', txId, error: simplifiedError });
                }

                // If the error originated from any transaction-related operation, try to clean up.
                if (type.startsWith('db-transaction')) {
                    connection = activeTransactions.get(txId);
                    if (connection) {
                        // This might fail if connection is already lost, but it's a good faith effort.
                        try {
                            await connection.rollback();
                            connection.release();
                        } catch (cleanupError) {
                            logger.error(`[Master] Failed to cleanup transaction ${txId} after error:`, cleanupError);
                        } finally {
                            activeTransactions.delete(txId);
                        }
                    }
                }
            }
        });

        childProcess.on('close', (code) => {
            logger.warn(`[${component.name}] exited with code ${code}. Restarting...`);
            childProcesses.delete(component.name);
            // Clean up any dangling transactions from the crashed process
            // This is complex; for now, we'll rely on DB timeouts. A better
            // implementation would track which tx belongs to which child.
            startComponent(component);
        });

        childProcess.on('error', (err) => logger.error(`[${component.name}] error: ${err}`));
        logger.info(`[Master] Starting component: ${component.name}...`);
    }

    components.forEach(startComponent);

    process.on('SIGINT', () => {
        logger.info('[Master] Shutting down all components...');
        childProcesses.forEach(child => child.kill('SIGINT'));
        dbManager.close();
        process.exit(0);
    });
}

main().catch(error => {
    logger.error('[Master] Critical error during startup:', error);
    process.exit(1);
});
