const logger = require('../../events/logger');
const chronosConfig = require('../../config/chronosConfig');
const { MetroInfoProvider } = require('../../utils/MetroInfoProvider');

class StatusManager {
    constructor(dbManager, dataManager, announcementService, statusEmbedManager) {
        this.dbManager = dbManager;
        this.dataManager = dataManager;
        this.announcementService = announcementService;
        this.statusEmbedManager = statusEmbedManager;
        this.metroInfoProvider = MetroInfoProvider.getInstance();
    }

    async handleServiceStart(operatingHours) {
        logger.info('[StatusManager] Handling service start...');
        await this.dataManager.setServiceStatus('open');
        await this.announcementService.announceServiceTransition('start', operatingHours);
        if (this.statusEmbedManager) {
            const data = this.metroInfoProvider.getFullData();
            await this.statusEmbedManager.updateAllEmbeds(data);
        }
    }

    async handleServiceEnd(operatingHours, now = new Date()) {
        logger.info('[StatusManager] Handling service end...');

        // Check for active or upcoming service extensions
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

        const upcomingExtensions = await this.dbManager.query(
            'SELECT * FROM metro_events WHERE event_end_datetime > ? AND event_start_datetime < ? AND is_active = 1',
            [now, oneHourFromNow]
        );

        if (upcomingExtensions.length > 0) {
            logger.info('[StatusManager] Service extension detected. Skipping standard service end procedure.');
            await this.announcementService.announceServiceTransition('end', operatingHours, 'with extensions');
            return;
        }

        await this.dataManager.setServiceStatus('closed');
        await this.announcementService.announceServiceTransition('end', operatingHours);
        if (this.statusEmbedManager) {
            const data = this.metroInfoProvider.getFullData();
            await this.statusEmbedManager.updateAllEmbeds(data);
        }
    }

    async handleFarePeriodChange(periodInfo) {
        logger.info(`[StatusManager] Handling fare period change to ${periodInfo.type}...`);
        await this.announcementService.announceFarePeriodChange(periodInfo.type, periodInfo);
        if (this.statusEmbedManager) {
            const data = this.metroInfoProvider.getFullData();
            await this.statusEmbedManager.updateAllEmbeds(data);
        }
    }

}

module.exports = StatusManager;
