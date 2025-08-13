
require('dotenv').config();
const mysql = require('mysql2');
const { EventEmitter } = require('events');

class DatabaseManager extends EventEmitter {
    constructor() {
        super();
        console.log('[DB] Initializing new DatabaseManager instance');
        this.connectionState = 'disconnected';
        this.connectionAttempts = 0;
        this.maxRetries = 5;
        this.retryDelay = 3000;
        this.pool = null;
        this.promisePool = null;
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
        console.log('[DB] Creating new connection pool with config:', {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306
        });

        this.pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            timezone: 'Z',
            decimalNumbers: true,
            charset: 'utf8mb4_unicode_ci',
            enableKeepAlive: true,
            keepAliveInitialDelay: 10000,
            connectTimeout: 10000,
            acquireTimeout: 10000
        });

        // Create promise-compatible pool
        this.promisePool = this.pool.promise();

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
            connection = await this.promisePool.getConnection();
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
            this.emit('connection_failed');
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

    async query(sql, params = [], options = {}) {
        if (this.connectionState !== 'connected') {
            console.error('[DB] Query attempted while disconnected');
            throw new Error('Database connection not available');
        }

        let connection;
        const startTime = Date.now();
        const queryId = Math.random().toString(36).substring(2, 8);
        const truncatedSql = sql.length > 100 ? sql.substring(0, 100) + '...' : sql;

        console.log(`[DB] [QID:${queryId}] Preparing query: ${truncatedSql}`);
      //  console.log(`[DB] [QID:${queryId}] Parameters:`, params.slice(0, 3));

        try {
            console.log(`[DB] [QID:${queryId}] Acquiring connection from pool`);
            connection = await this.promisePool.getConnection();
            
            console.log(`[DB] [QID:${queryId}] Executing query`);
            const [rows] = await connection.query(sql, params);
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
            connection = await this.promisePool.getConnection();
            
            console.log(`[DB] [TXID:${txId}] Beginning transaction`);
            await connection.beginTransaction();

            console.log(`[DB] [TXID:${txId}] Executing transaction callback`);
            const result = await callback({
                query: (sql, params) => {
                    console.log(`[DB] [TXID:${txId}] Executing transaction query:`, sql.substring(0, 100));
                    return connection.query(sql, params);
                },
                execute: (sql, params) => {
                    console.log(`[DB] [TXID:${txId}] Executing transaction statement:`, sql.substring(0, 100));
                    return connection.execute(sql, params);
                }
            });

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
            this.promisePool = null;
            this.connectionState = 'disconnected';
            console.log('[DB] Connection pool closed successfully');
        }
    }

    static #instance = null;
    static #initializationPromise = null;

    static async getInstance() {
        if (this.#instance) {
            console.log('[DB] Returning existing DatabaseManager instance');
            return this.#instance;
        }

        if (this.#initializationPromise) {
            console.log('[DB] Waiting for pending initialization');
            return this.#initializationPromise;
        }

        console.log('[DB] Creating new DatabaseManager instance');
        this.#initializationPromise = (async () => {
            try {
                const instance = new DatabaseManager();
                
                await new Promise((resolve, reject) => {
                    if (instance.connectionState === 'connected') {
                        console.log('[DB] Instance already connected');
                        resolve();
                        return;
                    }

                    const timeout = setTimeout(() => {
                        console.error('[DB] Connection timeout reached');
                        reject(new Error('Database connection timeout'));
                    }, 30000);

                    instance.once('connected', () => {
                        console.log('[DB] Instance connection established');
                        clearTimeout(timeout);
                        resolve();
                    });

                    instance.once('connection_failed', (err) => {
                        console.error('[DB] Instance connection failed');
                        clearTimeout(timeout);
                        reject(err);
                    });
                });

                this.#instance = instance;
                console.log('[DB] Instance initialization complete');
                return instance;
            } catch (error) {
                console.error('[DB] Instance initialization failed:', error.message);
                this.#initializationPromise = null;
                throw error;
            }
        })();

        return this.#initializationPromise;
    }
}

module.exports = DatabaseManager;
