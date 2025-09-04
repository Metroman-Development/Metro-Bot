const assert = require('assert');
const SchedulerService = require('../../src/core/SchedulerService');
const { MetroInfoProvider } = require('../../src/utils/MetroInfoProvider');
const bootstrap = require('../../src/core/bootstrap');

describe.skip('SchedulerService Events', () => {
    let scheduler;
    let db;
    let metroInfoProvider;

    beforeAll(async () => {
        require('dotenv').config();
        const { metroCore, databaseManager } = await bootstrap.initialize();
        db = databaseManager;
        metroInfoProvider = MetroInfoProvider.initialize(metroCore, db);
        scheduler = new SchedulerService(metroCore, db);
    }, 120000);

    beforeEach(async () => {
        // Clean up tables before each test
        await db.query('DELETE FROM event_station_status');
        await db.query('DELETE FROM event_details');
        await db.query('DELETE FROM metro_events');
        await db.query('DELETE FROM station_status_history');

        const esnStation = await db.query("SELECT station_id FROM metro_stations WHERE station_code = 'ESN'");
        const normalStatus = await db.query("SELECT status_type_id FROM operational_status_types WHERE status_name = 'normal'");

        if (esnStation.length > 0 && normalStatus.length > 0) {
            const stationId = esnStation[0].station_id;
            const statusId = normalStatus[0].status_type_id;

            // Ensure ESN station has a clean default status
            await db.query('DELETE FROM station_status WHERE station_id = ?', [stationId]);
            await db.query('INSERT INTO station_status (station_id, status_type_id) VALUES (?, ?)', [stationId, statusId]);
        }
    });

    it('should schedule and apply event status correctly', async () => {
        // 1. Insert a test event
        const now = new Date();
        const startTime = new Date(now.getTime() + 2000);
        const endTime = new Date(now.getTime() + 4000);

        const eventResult = await db.query(
            "INSERT INTO metro_events (event_name, event_date, start_time, end_time, description) VALUES (?, ?, ?, ?, ?)",
            ['Test Event', now.toISOString().slice(0, 10), startTime.toISOString().slice(11, 19), endTime.toISOString().slice(11, 19), 'A test event']
        );
        const eventId = eventResult.insertId;

        // 2. Insert event details
        await db.query(
            "INSERT INTO event_details (event_id, detail_type, station_code, line_code, description) VALUES (?, ?, ?, ?, ?)",
            [eventId, 'ingress', 'ESN', 'l6', 'Test Ingress']
        );

        // 3. Insert station status
        await db.query(
            "INSERT INTO event_station_status (event_id, station_code, status) VALUES (?, ?, ?)",
            [eventId, 'ESN', 'ingress_only']
        );

        // 4. Run the checkAndScheduleEvents method
        await metroInfoProvider.fetchAndSetEventData();
        await scheduler.checkAndScheduleEvents();

        // 5. Check if the station status is updated correctly
        // Wait for the event to start
        await new Promise(resolve => setTimeout(resolve, 3000));

        let stationStatus = await db.query("SELECT ost.status_name FROM station_status ss JOIN operational_status_types ost ON ss.status_type_id = ost.status_type_id JOIN metro_stations ms ON ss.station_id = ms.station_id WHERE ms.station_code = 'ESN'");
        expect(stationStatus[0].status_name).toBe('ingress_only');

        // 6. Check if the status is restored correctly after the event
        // Wait for the event to end
        await new Promise(resolve => setTimeout(resolve, 2000));

        stationStatus = await db.query("SELECT ost.status_name FROM station_status ss JOIN operational_status_types ost ON ss.status_type_id = ost.status_type_id JOIN metro_stations ms ON ss.station_id = ms.station_id WHERE ms.station_code = 'ESN'");
        expect(stationStatus[0].status_name).toBe('normal');
    }, 10000);
});
