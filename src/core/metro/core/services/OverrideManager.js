const mariadb = require('mariadb');
require('dotenv').config();
const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.METRODB_NAME,
    connectionLimit: 5
});

const StatusOverrideService = require('./StatusOverrideService');

class OverrideManager {
    constructor(metro) {
        this.metro = metro;
        this.statusOverrideService = new StatusOverrideService();
    }

    async addScheduledOverride({ targetType, targetId, status, message, source, startAt, endAt }) {
        let conn;
        try {
            conn = await pool.getConnection();
            const query = `
                INSERT INTO scheduled_status_overrides (target_type, target_id, status, message, source, start_at, end_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            await conn.query(query, [targetType, targetId, status, message, source, startAt, endAt]);
            console.log(`Added scheduled override for ${targetType} ${targetId}`);
        } catch (err) {
            console.error(`Could not add scheduled override: ${err.message}`);
            throw err;
        } finally {
            if (conn) conn.release();
        }
    }

    async checkScheduledOverrides() {
        let conn;
        try {
            conn = await pool.getConnection();
            const query = `
                SELECT * FROM scheduled_status_overrides
                WHERE (start_at <= NOW() AND end_at >= NOW() AND is_active = 0) OR (end_at < NOW() AND is_active = 1)
            `;
            const scheduledOverrides = await conn.query(query);

            for (const override of scheduledOverrides) {
                const now = new Date();
                const startAt = new Date(override.start_at);
                const endAt = new Date(override.end_at);
                const shouldBeActive = now >= startAt && now <= endAt;

                if (shouldBeActive && !override.is_active) {
                    await this.activateOverride(conn, override);
                } else if (!shouldBeActive && override.is_active) {
                    await this.deactivateOverride(conn, override);
                }
            }
        } catch (err) {
            console.error(`Could not check scheduled overrides: ${err.message}`);
            throw err;
        } finally {
            if (conn) conn.release();
        }
    }

    async activateOverride(conn, override) {
        // Add to status_overrides table
        await this.statusOverrideService.addOverride({
            targetType: override.target_type,
            targetId: override.target_id,
            status: override.status,
            message: override.message,
            source: override.source,
            expiresAt: override.end_at
        });

        // Announce the override
        const announcer = this.metro._subsystems.changeAnnouncer;
        if (announcer) {
            const announcement = {
                type: 'override_activated',
                target_type: override.target_type,
                target_id: override.target_id,
                status: override.status,
                message: override.message,
                source: override.source
            };
            announcer.announce(announcement);
        }

        // Update scheduled_status_overrides table
        await conn.query("UPDATE scheduled_status_overrides SET is_active = 1 WHERE id = ?", [override.id]);
        console.log(`Activated override ${override.id}`);
    }

    async deactivateOverride(conn, override) {
        // Update scheduled_status_overrides table
        await conn.query("UPDATE scheduled_status_overrides SET is_active = 0 WHERE id = ?", [override.id]);

        await this.statusOverrideService.removeOverride({
            targetType: override.target_type,
            targetId: override.target_id,
            source: override.source
        });

        // Announce the deactivation
        const announcer = this.metro._subsystems.changeAnnouncer;
        if (announcer) {
            const announcement = {
                type: 'override_deactivated',
                target_type: override.target_type,
                target_id: override.target_id,
                source: override.source
            };
            announcer.announce(announcement);
        }

        console.log(`Deactivated override ${override.id}`);
    }
}

module.exports = OverrideManager;
