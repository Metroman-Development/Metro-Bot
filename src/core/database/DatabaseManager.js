const mariadb = require('mariadb');
const { EventEmitter } = require('events');

class DatabaseManager extends EventEmitter {
    constructor(config) {
        super();
        console.log('[DB] Initializing new DatabaseManager instance');
        this.config = config;
        this.connectionState = 'disconnected';
        this.connectionAttempts = 0;
        this.maxRetries = 5;
        this.retryDelay = 3000;
        this.pool = null;
        this.healthCheckInterval = 60000;
        this.initialize();
    }

    async initialize() {
        console.log('[DB] Starting initialization...');
        try {
            await this.createConnectionPool();
            this.startHealthChecks();
            console.log('[DB] Initialization completed successfully');
        } catch (error) {
            console.error('[DB] Initialization failed:', error.message);
            this.scheduleRetry();
        }
    }

    async createConnectionPool() {
        console.log('[DB] Creating new connection pool with config:', this.config);
        console.log(this.config);

        this.pool = mariadb.createPool({
            host: this.config.host,
            user: this.config.user,
            password: this.config.password,
            database: this.config.database,
            port: this.config.port || 3306,
            connectionLimit: 50,
            connectTimeout: 10000, // 10 seconds
            timezone: 'Z',
        });

        console.log('[DB] Connection pool created, testing connection...');
        await this.testConnection();
        this.connectionState = 'connected';
        this.connectionAttempts = 0;
        console.log('[DB] Connection established successfully');
        this.emit('connected');
    }

    async testConnection() {
        let connection;
        try {
            console.log('[DB] Acquiring connection for health check...');
            connection = await this.pool.getConnection();
            console.log('[DB] Executing ping test...');
            await connection.ping();
            console.log('[DB] Connection test successful');
            return true;
        } catch (error) {
            console.error('[DB] Connection test failed:', error.message);
            this.connectionState = 'disconnected';
            throw error;
        } finally {
            if (connection) {
                console.log('[DB] Releasing health check connection');
                connection.release();
            }
        }
    }

    startHealthChecks() {
        console.log(`[DB] Starting health checks every ${this.healthCheckInterval/1000} seconds`);
        this.healthCheckTimer = setInterval(async () => {
            console.log('[DB] Running periodic health check...');
            try {
                await this.testConnection();
                this.connectionState = 'connected';
                console.log('[DB] Health check passed');
            } catch (error) {
                console.error('[DB] Health check failed:', error.message);
                this.connectionState = 'disconnected';
                this.emit('connection_lost', error);
                this.scheduleRetry();
            }
        }, this.healthCheckInterval);
    }

    async scheduleRetry() {
        if (this.connectionAttempts >= this.maxRetries) {
            console.error('[DB] Max connection retries reached - giving up');
            this.emit('connection_failed', new Error('Max connection retries reached'));
            return;
        }

        this.connectionAttempts++;
        const delay = this.retryDelay * Math.pow(2, this.connectionAttempts - 1);
        console.log(`[DB] Scheduling retry #${this.connectionAttempts} in ${delay/1000} seconds`);
        
        this.retryTimer = setTimeout(async () => {
            console.log('[DB] Attempting connection retry...');
            try {
                await this.createConnectionPool();
            } catch (error) {
                console.error('[DB] Retry attempt failed:', error.message);
                this.scheduleRetry();
            }
        }, delay);
    }

    async query(sql, params = []) {
        if (this.connectionState !== 'connected') {
            console.error('[DB] Query attempted while disconnected');
            throw new Error('Database connection not available');
        }

        let connection;
        const startTime = Date.now();
        const queryId = Math.random().toString(36).substring(2, 8);
        const truncatedSql = sql.length > 100 ? sql.substring(0, 100) + '...' : sql;

        console.log(`[DB] [QID:${queryId}] Preparing query: ${truncatedSql}`);

        try {
            console.log(`[DB] [QID:${queryId}] Acquiring connection from pool`);
            connection = await this.pool.getConnection();
            
            console.log(`[DB] [QID:${queryId}] Executing query`);
            const rows = await connection.query(sql, params);
            const duration = Date.now() - startTime;

            console.log(`[DB] [QID:${queryId}] Query completed in ${duration}ms, returned ${rows.length} rows`);
            return rows;
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[DB] [QID:${queryId}] Query failed after ${duration}ms:`, error.message);
            console.error(`[DB] [QID:${queryId}] Error details:`, {
                code: error.code,
                sqlState: error.sqlState,
                errno: error.errno
            });

            if (this.isConnectionError(error)) {
                console.error('[DB] Connection error detected - marking as disconnected');
                this.connectionState = 'disconnected';
                this.emit('connection_lost', error);
                this.scheduleRetry();
            }

            throw this.formatError(error, sql);
        } finally {
            if (connection) {
                console.log(`[DB] [QID:${queryId}] Releasing connection back to pool`);
                connection.release();
            }
        }
    }

    isConnectionError(error) {
        const connectionErrors = [
            'ECONNREFUSED',
            'PROTOCOL_CONNECTION_LOST',
            'ER_CON_COUNT_ERROR',
            'ETIMEDOUT',
            'EHOSTUNREACH'
        ];
        return connectionErrors.includes(error.code) || 
               error.message.includes('Connection lost');
    }

    isConnected() {
        return this.connectionState === 'connected';
    }

    async ping() {
        try {
            await this.testConnection();
            return true;
        } catch (error) {
            return false;
        }
    }

    formatError(error, sql) {
        console.log('[DB] Formatting database error for reporting');
        const formatted = new Error(`Database error: ${error.message}`);
        formatted.code = error.code;
        formatted.sql = sql.substring(0, 200) + (sql.length > 200 ? '...' : '');
        formatted.originalError = {
            message: error.message,
            code: error.code,
            errno: error.errno,
            sqlState: error.sqlState
        };
        return formatted;
    }

    async transaction(callback) {
        if (this.connectionState !== 'connected') {
            console.error('[DB] Transaction attempted while disconnected');
            throw new Error('Database connection not available');
        }

        let connection;
        const txId = Math.random().toString(36).substring(2, 8);
        console.log(`[DB] [TXID:${txId}] Starting new transaction`);

        try {
            console.log(`[DB] [TXID:${txId}] Acquiring connection for transaction`);
            connection = await this.pool.getConnection();
            
            console.log(`[DB] [TXID:${txId}] Beginning transaction`);
            await connection.beginTransaction();

            console.log(`[DB] [TXID:${txId}] Executing transaction callback`);
            const result = await callback(connection);

            console.log(`[DB] [TXID:${txId}] Committing transaction`);
            await connection.commit();
            
            console.log(`[DB] [TXID:${txId}] Transaction completed successfully`);
            return result;
        } catch (error) {
            console.error(`[DB] [TXID:${txId}] Transaction failed:`, error.message);
            
            if (connection) {
                console.log(`[DB] [TXID:${txId}] Rolling back transaction`);
                await connection.rollback();
            }
            
            throw error;
        } finally {
            if (connection) {
                console.log(`[DB] [TXID:${txId}] Releasing transaction connection`);
                connection.release();
            }
        }
    }

    async close() {
        console.log('[DB] Shutting down DatabaseManager...');
        
        if (this.healthCheckTimer) {
            console.log('[DB] Clearing health check interval');
            clearInterval(this.healthCheckTimer);
        }
        
        if (this.retryTimer) {
            console.log('[DB] Clearing pending retry timer');
            clearTimeout(this.retryTimer);
        }

        if (this.pool) {
            console.log('[DB] Closing connection pool');
            await this.pool.end();
            this.pool = null;
            this.connectionState = 'disconnected';
            console.log('[DB] Connection pool closed successfully');
        }
    }

    static #instance = null;
    static #initializationPromise = null;

    static async getInstance(config) {
        if (this.#instance) {
            console.log('[DB] Returning existing DatabaseManager instance');
            return this.#instance;
        }

        if (this.#initializationPromise) {
            console.log('[DB] Waiting for pending initialization');
            return this.#initializationPromise;
        }

        if (!config) {
            throw new Error('DatabaseManager requires a configuration object for the first initialization.');
        }

        console.log('[DB] Creating new DatabaseManager instance');

        this.#initializationPromise = (async () => {
            try {
                const instance = new DatabaseManager(config);
                
                await new Promise((resolve, reject) => {
                    if (instance.connectionState === 'connected') {
                        resolve();
                        return;
                    }

                    const timeout = setTimeout(() => {
                        reject(new Error('Database connection timeout'));
                    }, 30000); // Increased timeout to 30 seconds

                    instance.once('connected', () => {
                        clearTimeout(timeout);
                        resolve();
                    });

                    instance.once('connection_failed', (err) => {
                        clearTimeout(timeout);
                        reject(err); // This will be caught by the outer catch block
                    });
                });

                this.#instance = instance;
                return instance;
            } catch (error) {
                console.error(`[DB] Final connection attempt failed: ${error.message}.`);
                this.#instance = null;
                this.#initializationPromise = null;
                throw new Error(`Failed to connect to the database: ${error.message}`);
            }
        })();

        return this.#initializationPromise;
    }
}

const isWorker = process.env.IS_WORKER_PROCESS === 'true';

if (isWorker) {
    module.exports = require('./DatabaseManagerProxy');
} else {
    module.exports = DatabaseManager;
}
