const SchedulerService = require('../../src/core/SchedulerService');
const StatusManager = require('../../src/core/status/StatusManager');
const MetroInfoProvider = require('../../src/utils/MetroInfoProvider');
const chronosConfig = require('../../src/config/chronosConfig');

jest.mock('../../src/core/bootstrap', () => ({
    initialize: jest.fn().mockResolvedValue({
        metroCore: {
            statusManager: {},
        },
        databaseManager: {
            query: jest.fn().mockResolvedValue([]),
        },
    }),
}));

const bootstrap = require('../../src/core/bootstrap');

describe('Scheduler and Status Fixes', () => {
    let scheduler;
    let statusManager;
    let db;
    let metroInfoProvider;
    let metroCore;

    beforeAll(async () => {
        const { metroCore: mCore, databaseManager } = await bootstrap.initialize('TEST');
        metroCore = mCore;
        db = databaseManager;

        // Since bootstrap is mocked, we need to manually create and set instances
        metroInfoProvider = new MetroInfoProvider(metroCore, db);
        MetroInfoProvider.instance = metroInfoProvider;


        // Mocking services that are not under test
        const announcementService = {
            announceServiceTransition: jest.fn(),
            announceFarePeriodChange: jest.fn(),
        };
        const dataManager = {
            setServiceStatus: jest.fn(),
        };

        statusManager = new StatusManager(db, dataManager, announcementService, null);
        scheduler = new SchedulerService(metroCore, db, announcementService, null, metroInfoProvider);

        // Replace the real statusManager in the scheduler with our test instance
        metroCore.statusManager = statusManager;

    }, 120000);

    afterEach(() => {
        jest.useRealTimers();
    });

    beforeEach(async () => {
        // Clean up tables before each test
        await db.query('DELETE FROM event_station_status');
        await db.query('DELETE FROM event_details');
        await db.query('DELETE FROM metro_events');
        await db.query('DELETE FROM station_status');
    });

    test('should handle service extension correctly and not close extended stations during regular service end', async () => {
        const serviceEndTime = new Date('2025-08-30T23:00:00.000Z');
        const extensionEndTime = new Date('2025-08-31T01:00:00.000Z');

        // 1. Create a service extension event in the database
        db.query.mockResolvedValueOnce([{
            event_name: 'Test Extension',
            description: 'Test Extension Event',
            event_start_datetime: serviceEndTime,
            event_end_datetime: extensionEndTime,
            is_active: 1
        }]);

        // 2. Trigger the handleServiceEnd job, passing the specific time
        await statusManager.handleServiceEnd({ closing: '23:00' }, serviceEndTime);

        // 3. Verify that setServiceStatus('closed') was NOT called because of the extension
        expect(statusManager.dataManager.setServiceStatus).not.toHaveBeenCalledWith('closed');
    });

    test('should trigger fare period change jobs correctly', async () => {
        const handleFarePeriodChangeSpy = jest.spyOn(statusManager, 'handleFarePeriodChange');

        // Find the specific job from the config
        const morningPuntaJob = chronosConfig.jobs.find(j => j.name === 'Fare Period to Punta (Morning)');

        // Create the task function manually
        const taskFunction = async (job) => {
            const periodInfo = { type: job.period };
            await statusManager.handleFarePeriodChange(periodInfo);
        };

        // Execute the task for the morning Punta job
        await taskFunction(morningPuntaJob);
        expect(handleFarePeriodChangeSpy).toHaveBeenCalledWith({ type: 'PUNTA' });

        // Test another transition
        const eveningBajoJob = chronosConfig.jobs.find(j => j.name === 'Fare Period to Bajo (Evening)');
        await taskFunction(eveningBajoJob);
        expect(handleFarePeriodChangeSpy).toHaveBeenCalledWith({ type: 'BAJO' });
    });
});
