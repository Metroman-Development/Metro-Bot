const mariadb = require('mariadb');
require('dotenv').config();
const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.METRODB_NAME,
    connectionLimit: 5
});

class StatusOverrideService {
    constructor() {}

    async addOverride({ targetType, targetId, status, message, source, expiresAt }) {
        let conn;
        try {
            conn = await pool.getConnection();
            const query = `
                INSERT INTO status_overrides (target_type, target_id, status, message, source, expires_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            await conn.query(query, [targetType, targetId, status, message, source, expiresAt]);
            console.log(`Added override for ${targetType} ${targetId}`);
        } catch (err) {
            console.error(`Could not add override: ${err.message}`);
            throw err;
        } finally {
            if (conn) conn.release();
        }
    }

    async getActiveOverrides() {
        let conn;
        try {
            conn = await pool.getConnection();
            const query = `
                SELECT * FROM status_overrides
                WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > NOW())
            `;
            const overrides = await conn.query(query);
            return overrides;
        } catch (err) {
            console.error(`Could not get active overrides: ${err.message}`);
            throw err;
        } finally {
            if (conn) conn.release();
        }
    }

    async removeOverride({ targetType, targetId, source }) {
        let conn;
        try {
            conn = await pool.getConnection();
            const query = `
                DELETE FROM status_overrides
                WHERE target_type = ? AND target_id = ? AND source = ?
            `;
            await conn.query(query, [targetType, targetId, source]);
            console.log(`Removed override for ${targetType} ${targetId}`);
        } catch (err) {
            console.error(`Could not remove override: ${err.message}`);
            throw err;
        } finally {
            if (conn) conn.release();
        }
    }

    applyOverrides(data, overrides) {
        if (!data || !overrides) {
            return data;
        }

        const dataWithOverrides = JSON.parse(JSON.stringify(data));

        for (const override of overrides) {
            const { target_type, target_id, status, message } = override;

            if (target_type === 'line') {
                if (dataWithOverrides.lines && dataWithOverrides.lines[target_id]) {
                    dataWithOverrides.lines[target_id].status.code = status;
                    dataWithOverrides.lines[target_id].status.message = message;
                }
            } else if (target_type === 'station') {
                if (dataWithOverrides.stations && dataWithOverrides.stations[target_id]) {
                    dataWithOverrides.stations[target_id].status.code = status;
                    dataWithOverrides.stations[target_id].status.message = message;
                }
            } else if (target_type === 'system') {
                if (dataWithOverrides.network) {
                    dataWithOverrides.network.status = status;
                    dataWithOverrides.network.message = message;
                }
            }
        }

        return dataWithOverrides;
    }
}

module.exports = StatusOverrideService;