const logger = require('../../events/logger');
const chronosConfig = require('../../config/chronosConfig');

class StatusManager {
    constructor(dbManager, apiService, announcementService) {
        this.dbManager = dbManager;
        this.apiService = apiService;
        this.announcementService = announcementService;
    }

    async handleServiceStart(operatingHours) {
        logger.info('[StatusManager] Handling service start...');
        await this.apiService.setServiceStatus('open');
        await this.announcementService.announceServiceTransition('start', operatingHours);
    }

    async handleServiceEnd(operatingHours) {
        logger.info('[StatusManager] Handling service end...');
        await this.apiService.setServiceStatus('closed');
        await this.announcementService.announceServiceTransition('end', operatingHours);
    }

    async handleFarePeriodChange(periodInfo) {
        logger.info(`[StatusManager] Handling fare period change to ${periodInfo.type}...`);
        await this.announcementService.announceFarePeriodChange(periodInfo.type, periodInfo);
        // May not need a status update, but we'll see.
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
