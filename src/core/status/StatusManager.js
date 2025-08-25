const logger = require('../../events/logger');

const chronosConfig = require('../../config/chronosConfig');

class StatusManager {
    constructor(dbManager) {
        this.dbManager = dbManager;
    }

    async activateExpressService() {
        logger.info('[StatusManager] Activating express service...');
        const expressLines = chronosConfig.expressLines;
        for (const lineId of expressLines) {
            const query = `UPDATE metro_lines SET express_status = 'active' WHERE line_id = ?`;
            await this.dbManager.query(query, [lineId.toLowerCase()]);
            logger.info(`[StatusManager] Express service activated for line ${lineId}`);
        }
    }

    async deactivateExpressService() {
        logger.info('[StatusManager] Deactivating express service...');
        const expressLines = chronosConfig.expressLines;
        for (const lineId of expressLines) {
            const query = `UPDATE metro_lines SET express_status = 'inactive' WHERE line_id = ?`;
            await this.dbManager.query(query, [lineId.toLowerCase()]);
            logger.info(`[StatusManager] Express service deactivated for line ${lineId}`);
        }
    }
}

module.exports = StatusManager;
