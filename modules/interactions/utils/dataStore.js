const { DatabaseManager } = require('../../../core/database/DatabaseManager');
const logger = require('../../../events/logger');

class InteractionDataStore {
    constructor() {
        this.db = DatabaseManager;
        
    }

    async initializeTable() {
        try {
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS interactions (
                    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    interaction_id VARCHAR(32) NOT NULL,
                    type ENUM('command', 'button', 'select_menu', 'modal') NOT NULL,
                    user_id VARCHAR(32) NOT NULL,
                    guild_id VARCHAR(32),
                    data JSON DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY (interaction_id),
                    INDEX (user_id),
                    INDEX (guild_id),
                    INDEX (type)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
            logger.info('Interactions table verified/created');
        } catch (error) {
            console.error('Failed to initialize interactions table:', error);
            throw error;
        }
    }

    async saveInteraction(interactionType, interactionId, metadata) {
        try {
            await this.db.query(
                `INSERT INTO interactions 
                (interaction_id, type, user_id, guild_id, data) 
                VALUES (?, ?, ?, ?, ?)`,
                [
                    interactionId,
                    interactionType,
                    metadata.userId,
                    metadata.guildId,
                    JSON.stringify(metadata.data)
                ]
            );
        } catch (error) {
            logger.error(`Failed to save interaction: ${error.message}`);
            throw error;
        }
    }

    async getInteraction(interactionId) {
        const [data] = await this.db.query(
            'SELECT * FROM interactions WHERE interaction_id = ?',
            [interactionId]
        );
        return data ? { ...data, data: JSON.parse(data.data) } : null;
    }
}

module.exports = new InteractionDataStore();