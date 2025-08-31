const bootstrap = require('./src/core/bootstrap');
const SchedulerService = require('./src/core/SchedulerService');
const AnnouncementService = require('./src/core/metro/announcers/AnnouncementService');
const StatusEmbedManager = require('./src/core/status/StatusEmbedManager');
const logger = require('./src/events/logger');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    logger.info('[VERIFY] Starting verification script...');

    logger.info('[VERIFY] Waiting 10 seconds for DB to initialize...');
    await sleep(10000);

    const { metroCore, databaseManager } = await bootstrap.initialize('VERIFY');
    const db = databaseManager;

    const announcementService = new AnnouncementService();
    const mockClient = { channels: { cache: new Map() } };
    const statusEmbedManager = new StatusEmbedManager(mockClient);

    const scheduler = new SchedulerService(metroCore, db, announcementService, statusEmbedManager);

    const lineId = 'l1';
    const endTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    const affectedStations = [
        { station_code: 'PZA', status: 'ingress_only' },
        { station_code: 'MAN', status: 'ingress_only' }
    ];

    logger.info(`[VERIFY] Calling scheduleExtensionOfService for line ${lineId}`);
    await scheduler.scheduleExtensionOfService(lineId, endTime, affectedStations);

    logger.info('[VERIFY] Checking database for new event...');
    const [events] = await db.query('SELECT * FROM metro_events WHERE event_name = "extension" ORDER BY id DESC LIMIT 1');

    if (events && events.length > 0) {
        logger.info(`[VERIFY] SUCCESS: Found extension event with ID ${events[0].id} in the database.`);
        const eventId = events[0].id;

        const [details] = await db.query('SELECT * FROM event_details WHERE event_id = ?', [eventId]);
        if (details && details.length > 0) {
            logger.info('[VERIFY] SUCCESS: Found event details.');
        } else {
            logger.error('[VERIFY] FAILURE: Did not find event details.');
        }

        const [stations] = await db.query('SELECT * FROM event_station_status WHERE event_id = ?', [eventId]);
        if (stations && stations.length === 2) {
            logger.info('[VERIFY] SUCCESS: Found correct number of station statuses.');
        } else {
            logger.error(`[VERIFY] FAILURE: Found ${stations ? stations.length : 0} station statuses, expected 2.`);
        }
    } else {
        logger.error('[VERIFY] FAILURE: Did not find the extension event in the database.');
    }

    logger.info('[VERIFY] Verification script finished.');
}

main().catch(err => {
    logger.error('[VERIFY] Error during verification:', err);
    process.exit(1);
}).finally(() => {
    if (bootstrap.databaseManager) {
        bootstrap.databaseManager.close();
    }
    process.exit(0);
});
