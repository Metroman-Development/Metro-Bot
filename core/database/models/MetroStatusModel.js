class MetroStatusModel {
    constructor(db) {
        this.db = db;
        this.cache = new (require('./CacheModel'))(db);
        this.statusNamespace = 'metro:status';
    }

    /**
     * Saves the complete network status to database
     * @param {Object} statusData - The status data from MetroCore
     * @param {number} ttl - Cache TTL in milliseconds (default: 5 minutes)
     */
    async saveNetworkStatus(statusData, ttl = 300000) {
        try {
            // Save to cache for fast access
            await this.cache.set(
                this.statusNamespace,
                'network',
                statusData,
                ttl
            );

            // Save to persistent storage
            await this.db.query(
                `INSERT INTO metro_status 
                (data_version, network_status, line_data, station_data, last_updated)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    network_status = VALUES(network_status),
                    line_data = VALUES(line_data),
                    station_data = VALUES(station_data),
                    last_updated = VALUES(last_updated)`,
                [
                    statusData.version,
                    statusData.status,
                    JSON.stringify(statusData.lines),
                    JSON.stringify(statusData.stations),
                    new Date()
                ]
            );

            // Cleanup expired entries
            await this.cleanupExpiredStatuses();
        } catch (error) {
            console.error('Failed to save network status:', error);
            throw error;
        }
    }

    /**
     * Gets the current network status (checks cache first)
     */
    async getCurrentStatus() {
        try {
            // Check cache first
            const cached = await this.cache.get(this.statusNamespace, 'network');
            if (cached) {
                return cached.value;
            }

            // Fallback to database
            const [result] = await this.db.query(`
                SELECT * FROM metro_status
                ORDER BY last_updated DESC
                LIMIT 1
            `);

            if (result && result.length > 0) {
                const status = {
                    version: result[0].data_version,
                    status: result[0].network_status,
                    lastUpdated: result[0].last_updated,
                    lines: JSON.parse(result[0].line_data),
                    stations: JSON.parse(result[0].station_data)
                };

                // Cache the result
                await this.cache.set(
                    this.statusNamespace,
                    'network',
                    status,
                    300000 // 5 minutes
                );

                return status;
            }

            return null;
        } catch (error) {
            console.error('Failed to get current status:', error);
            throw error;
        }
    }

    /**
     * Gets status history for a specific line or station
     * @param {string} type - 'line' or 'station'
     * @param {string} id - The line/station ID
     * @param {number} limit - Number of historical entries to return
     */
    async getStatusHistory(type, id, limit = 10) {
        try {
            const cacheKey = `history:${type}:${id}`;
            const cached = await this.cache.get(this.statusNamespace, cacheKey);
            if (cached) {
                return cached.value;
            }

            let column;
            if (type === 'line') {
                column = 'line_data';
            } else if (type === 'station') {
                column = 'station_data';
            } else {
                throw new Error('Invalid type - must be "line" or "station"');
            }

            const [results] = await this.db.query(`
                SELECT 
                    data_version,
                    network_status,
                    ${column} as status_data,
                    last_updated
                FROM metro_status
                ORDER BY last_updated DESC
                LIMIT ?
            `, [limit]);

            const history = results.map(row => ({
                version: row.data_version,
                status: row.network_status,
                data: JSON.parse(row.status_data),
                timestamp: row.last_updated
            }));

            // Cache the history
            await this.cache.set(
                this.statusNamespace,
                cacheKey,
                history,
                600000 // 10 minutes
            );

            return history;
        } catch (error) {
            console.error('Failed to get status history:', error);
            throw error;
        }
    }

    /**
     * Cleans up expired status entries
     */
    async cleanupExpiredStatuses(daysToKeep = 7) {
        try {
            await this.db.query(`
                DELETE FROM metro_status
                WHERE last_updated < DATE_SUB(NOW(), INTERVAL ? DAY)
            `, [daysToKeep]);
        } catch (error) {
            console.error('Failed to cleanup expired statuses:', error);
            throw error;
        }
    }

    /**
     * Initializes the database table
     */
    async initializeTable() {
        try {
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS metro_status (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                    data_version VARCHAR(255) NOT NULL,
                    network_status VARCHAR(50) NOT NULL,
                    line_data JSON NOT NULL,
                    station_data JSON NOT NULL,
                    last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id),
                    KEY idx_last_updated (last_updated),
                    KEY idx_data_version (data_version)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `);
        } catch (error) {
            console.error('Failed to initialize metro_status table:', error);
            throw error;
        }
    }
}

module.exports = MetroStatusModel;