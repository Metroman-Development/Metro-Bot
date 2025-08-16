class ConnectionProxy {
    /**
     * @param {string} txId The unique ID for this transaction.
     * @param {import('./DatabaseManagerProxy')} manager The proxy manager instance.
     */
    constructor(txId, manager) {
        if (!txId || !manager) {
            throw new Error('[ConnectionProxy] Transaction ID and a manager instance are required.');
        }
        this.txId = txId;
        this.manager = manager;
    }

    /**
     * Executes a query within the context of this transaction.
     * @param {string} sql The SQL query to execute.
     * @param {Array} params The parameters for the query.
     * @returns {Promise<any>} A promise that resolves with the query result.
     */
    query(sql, params = []) {
        // The manager's query method will be adapted to handle a txId.
        return this.manager.query(sql, params, this.txId);
    }

    // The real mariadb connection object has other methods like `commit`, `rollback`, etc.
    // The user's callback should not be calling these directly, as the manager handles it.
    // We add them here and have them throw an error to prevent misuse.
    commit() {
        return Promise.reject(new Error('[ConnectionProxy] Do not call commit directly. The transaction is managed automatically.'));
    }

    rollback() {
        return Promise.reject(new Error('[ConnectionProxy] Do not call rollback directly. The transaction is managed automatically.'));
    }

    release() {
        return Promise.reject(new Error('[ConnectionProxy] Do not call release directly. The transaction is managed automatically.'));
    }
}

module.exports = ConnectionProxy;
