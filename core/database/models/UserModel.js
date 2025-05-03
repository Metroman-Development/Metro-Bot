class UserModel {
    constructor(dbManager) {
        this.db = dbManager;
        this.table = 'users';
    }

    async createTable() {
        await this.db.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(64) PRIMARY KEY,
                username VARCHAR(32) NOT NULL,
                discriminator VARCHAR(4),
                avatar VARCHAR(128),
                bot BOOLEAN DEFAULT false,
                system BOOLEAN DEFAULT false,
                locale VARCHAR(16),
                premium_type TINYINT,
                flags INT DEFAULT 0,
                public_flags INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_username (username)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
    }

    async findById(userId) {
        return this.db.findOne(this.table, { id: userId });
    }

    async findByUsername(username) {
        return this.db.query(
            `SELECT * FROM ${this.table} WHERE username = ? LIMIT 1`,
            [username]
        ).then(rows => rows[0] || null);
    }

    async createOrUpdate(userData) {
        return this.db.transaction(async (conn) => {
            const exists = await conn.query(
                `SELECT 1 FROM ${this.table} WHERE id = ? LIMIT 1`,
                [userData.id]
            ).then(rows => rows.length > 0);

            if (exists) {
                await conn.execute(
                    `UPDATE ${this.table} SET ? WHERE id = ?`,
                    [userData, userData.id]
                );
            } else {
                await conn.execute(
                    `INSERT INTO ${this.table} SET ?`,
                    [userData]
                );
            }
            return userData;
        });
    }

    async updateFlags(userId, flags) {
        await this.db.execute(
            `UPDATE ${this.table} SET flags = ? WHERE id = ?`,
            [flags, userId]
        );
    }

    async getGuildMemberships(userId) {
        return this.db.query(`
            SELECT g.* FROM guilds g
            JOIN guild_members gm ON g.id = gm.guild_id
            WHERE gm.user_id = ?
        `, [userId]);
    }
}

module.exports = UserModel;