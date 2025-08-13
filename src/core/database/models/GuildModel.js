class GuildModel {
    constructor(dbManager) {
        this.db = dbManager;
        this.table = 'guilds';
    }

    async createTable() {
        await this.db.execute(`
            CREATE TABLE IF NOT EXISTS guilds (
                id VARCHAR(64) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                icon VARCHAR(128),
                splash VARCHAR(128),
                owner_id VARCHAR(64) NOT NULL,
                region VARCHAR(32),
                afk_channel_id VARCHAR(64),
                afk_timeout INT,
                verification_level TINYINT,
                default_message_notifications TINYINT,
                explicit_content_filter TINYINT,
                mfa_level TINYINT,
                system_channel_id VARCHAR(64),
                rules_channel_id VARCHAR(64),
                vanity_url_code VARCHAR(32),
                description TEXT,
                premium_tier TINYINT,
                premium_subscription_count INT,
                preferred_locale VARCHAR(16),
                nsfw_level TINYINT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_name (name),
                INDEX idx_owner (owner_id),
                FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await this.db.execute(`
            CREATE TABLE IF NOT EXISTS guild_members (
                guild_id VARCHAR(64) NOT NULL,
                user_id VARCHAR(64) NOT NULL,
                nick VARCHAR(32),
                roles TEXT,
                joined_at TIMESTAMP NOT NULL,
                premium_since TIMESTAMP,
                deaf BOOLEAN DEFAULT false,
                mute BOOLEAN DEFAULT false,
                pending BOOLEAN DEFAULT false,
                permissions VARCHAR(64),
                PRIMARY KEY (guild_id, user_id),
                FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
    }

    async findById(guildId) {
        return this.db.findOne(this.table, { id: guildId });
    }

    async findByName(name) {
        return this.db.query(
            `SELECT * FROM ${this.table} WHERE name LIKE ? LIMIT 50`,
            [`%${name}%`]
        );
    }

    async createOrUpdate(guildData) {
        return this.db.transaction(async (conn) => {
            const exists = await conn.query(
                `SELECT 1 FROM ${this.table} WHERE id = ? LIMIT 1`,
                [guildData.id]
            ).then(rows => rows.length > 0);

            if (exists) {
                await conn.execute(
                    `UPDATE ${this.table} SET ? WHERE id = ?`,
                    [guildData, guildData.id]
                );
            } else {
                await conn.execute(
                    `INSERT INTO ${this.table} SET ?`,
                    [guildData]
                );
            }
            return guildData;
        });
    }

    async getSettings(guildId) {
        const [settings] = await this.db.query(`
            SELECT * FROM guild_settings WHERE guild_id = ?
        `, [guildId]);
        return settings || null;
    }

    async updateSettings(guildId, settings) {
        await this.db.transaction(async (conn) => {
            await conn.execute(
                `DELETE FROM guild_settings WHERE guild_id = ?`,
                [guildId]
            );
            await conn.execute(
                `INSERT INTO guild_settings SET ?`,
                { guild_id: guildId, ...settings }
            );
        });
    }

    async getMembers(guildId) {
        return this.db.query(`
            SELECT u.* FROM users u
            JOIN guild_members gm ON u.id = gm.user_id
            WHERE gm.guild_id = ?
        `, [guildId]);
    }
}

module.exports = GuildModel;