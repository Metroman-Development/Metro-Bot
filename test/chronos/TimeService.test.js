describe('TimeService', () => {
    let TimeService;
    let timeService;
    let dbManagerMock;
    let DatabaseService;
    let timeHelpers;
    let moment;

    beforeEach(() => {
        jest.resetModules();

        dbManagerMock = {
            query: jest.fn(),
        };

        jest.doMock('../../src/core/database/DatabaseManager', () => ({
            getInstance: () => dbManagerMock,
        }));

        jest.doMock('../../src/core/database/DatabaseService', () => ({
            updateFarePeriod: jest.fn(),
            updateActiveEvent: jest.fn(),
        }));

        jest.doMock('../../src/core/chronos/timeHelpers', () => ({
            currentTime: null,
            isWithinOperatingHours: jest.fn(),
            getDayType: jest.fn(),
            isTimeBetween: jest.fn(),
        }));

        jest.doMock('../../src/events/logger', () => ({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        }));

        TimeService = require('../../src/core/chronos/TimeService');
        DatabaseService = require('../../src/core/database/DatabaseService');
        timeHelpers = require('../../src/core/chronos/timeHelpers');
        moment = require('moment-timezone');

        timeService = new TimeService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('checkFarePeriod', () => {
        it('should identify PUNTA period correctly', async () => {
            const fakeTime = moment.tz('2025-08-14 08:00:00', 'America/Santiago');
            timeHelpers.currentTime = fakeTime;
            timeHelpers.isWithinOperatingHours.mockReturnValue(true);
            timeHelpers.getDayType.mockReturnValue('weekday');
            timeHelpers.isTimeBetween.mockImplementation((time, start, end) => {
                const format = 'HH:mm';
                const currentTime = time.format(format);
                return currentTime >= start && currentTime < end;
            });

            const emitSpy = jest.spyOn(timeService, 'emit');

            await timeService.checkFarePeriod();

            expect(timeService.lastFarePeriod).toBe('PUNTA');
            expect(emitSpy).toHaveBeenCalledWith('farePeriodChange', { from: null, to: 'PUNTA' });
            expect(DatabaseService.updateFarePeriod).toHaveBeenCalledWith('PUNTA');
        });
    });

    describe('checkServiceStatus', () => {
        it('should emit serviceStart when service starts', async () => {
            timeService.lastServiceStatus = false;
            timeHelpers.isWithinOperatingHours.mockReturnValue(true);
            const emitSpy = jest.spyOn(timeService, 'emit');

            await timeService.checkServiceStatus();

            expect(emitSpy).toHaveBeenCalledWith('serviceStart');
        });
    });

    describe('checkEvents', () => {
        it('should emit activeEvent for an active event', async () => {
            const fakeEvent = { name: 'Test Event', startTime: '2025-08-14T10:00:00', endTime: '2025-08-14T12:00:00' };
            dbManagerMock.query.mockResolvedValue([{ events: JSON.stringify([fakeEvent]) }]);

            const fakeTime = moment.tz('2025-08-14 11:00:00', 'America/Santiago');
            timeHelpers.currentTime = fakeTime;

            const emitSpy = jest.spyOn(timeService, 'emit');

            await timeService.checkEvents();

            expect(emitSpy).toHaveBeenCalledWith('activeEvent', fakeEvent);
            expect(DatabaseService.updateActiveEvent).toHaveBeenCalledWith(fakeEvent);
        });
    });
});
