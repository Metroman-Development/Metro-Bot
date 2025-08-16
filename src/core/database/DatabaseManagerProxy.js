const { EventEmitter } = require('events');
const crypto = require('crypto');
const ConnectionProxy = require('./ConnectionProxy');

class DatabaseManagerProxy extends EventEmitter {
    constructor() {
        super();
        this.pendingQueries = new Map();
        this.pendingTxLifecycle = new Map(); // For begin, commit, rollback
        this.queryIdCounter = 0;
        this.ipcAvailable = typeof process.send === 'function';

        if (this.ipcAvailable) {
            process.on('message', this.handleMasterMessage.bind(this));
        } else {
            console.error('[DBProxy] FATAL: Not in a worker process, IPC not available.');
        }
    }

    handleMasterMessage(message) {
        const { type, queryId, txId, result, error } = message;

        // Route to query handler
        if (type === 'db-result' || type === 'db-error') {
            const promiseActions = this.pendingQueries.get(queryId);
            if (promiseActions) {
                clearTimeout(promiseActions.timeoutHandle);
                if (error) {
                    const hydratedError = new Error(error.message);
                    hydratedError.code = error.code;
                    promiseActions.reject(hydratedError);
                } else {
                    promiseActions.resolve(result);
                }
                this.pendingQueries.delete(queryId);
            }
            return;
        }

        // Route to transaction lifecycle handler
        if (type.startsWith('db-transaction-')) {
            const promiseActions = this.pendingTxLifecycle.get(txId);
            if (promiseActions) {
                clearTimeout(promiseActions.timeoutHandle);
                if (error) {
                    const hydratedError = new Error(error.message);
                    hydratedError.code = error.code;
                    promiseActions.reject(hydratedError);
                } else {
                    promiseActions.resolve();
                }
                this.pendingTxLifecycle.delete(txId);
            }
        }
    }

    query(sql, params = [], txId = null) { // Added txId parameter
        return new Promise((resolve, reject) => {
            if (!this.ipcAvailable) {
                return reject(new Error('[DBProxy] IPC channel not available.'));
            }
            const queryId = this.queryIdCounter++;
            const timeoutHandle = setTimeout(() => {
                if (this.pendingQueries.has(queryId)) {
                    this.pendingQueries.delete(queryId);
                    reject(new Error(`[DBProxy] Query timed out after 30 seconds (Query ID: ${queryId})`));
                }
            }, 30000);
            this.pendingQueries.set(queryId, { resolve, reject, timeoutHandle });

            // Create the message payload, differentiating between
            // standalone queries and transactional queries.
            const message = {
                queryId,
                sql,
                params,
            };

            if (txId) {
                message.type = 'db-transaction-query';
                message.txId = txId;
            } else {
                message.type = 'db-query';
            }

            process.send(message);
        });
    }

    async transaction(callback) {
        if (!this.ipcAvailable) {
            throw new Error('[DBProxy] IPC channel not available for transaction.');
        }

        const txId = crypto.randomBytes(16).toString('hex');
        const connectionProxy = new ConnectionProxy(txId, this);

        try {
            // 1. Begin
            await this._sendTxLifecycleMessage(txId, 'db-transaction-begin');

            // 2. Execute callback
            const result = await callback(connectionProxy);

            // 3. Commit
            await this._sendTxLifecycleMessage(txId, 'db-transaction-commit');

            return result;
        } catch (error) {
            // 4. Rollback
            this._sendTxLifecycleMessage(txId, 'db-transaction-rollback').catch(rbError => {
                console.error(`[DBProxy] CRITICAL: Failed to send rollback command for txId ${txId}`, rbError);
            });
            throw error; // Re-throw the original error that caused the rollback
        }
    }

    _sendTxLifecycleMessage(txId, type) {
        return new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                if (this.pendingTxLifecycle.has(txId)) {
                    this.pendingTxLifecycle.delete(txId);
                    reject(new Error(`[DBProxy] Transaction command '${type}' timed out for txId: ${txId}`));
                }
            }, 30000);

            this.pendingTxLifecycle.set(txId, { resolve, reject, timeoutHandle });
            process.send({ type, txId });
        });
    }

    close() { return Promise.resolve(); }
    isConnected() { return this.ipcAvailable; }

    static #instance = null;
    static getInstance() {
        if (!this.#instance) {
            this.#instance = new DatabaseManagerProxy();
        }
        return this.#instance;
    }
}

module.exports = DatabaseManagerProxy;
