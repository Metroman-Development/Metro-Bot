const UpdateListener = require('../src/core/status/embeds/UpdateListener');
const EventRegistry = require('../src/core/EventRegistry');
const EventEmitter = require('events');

describe('UpdateListener', () => {
    let metroCore;
    let statusUpdater;
    let listener;

    beforeEach(() => {
        const emitter = new EventEmitter();
        metroCore = {
            emit: emitter.emit.bind(emitter),
            on: emitter.on.bind(emitter),
            removeAllListeners: emitter.removeAllListeners.bind(emitter),
            eventNames: emitter.eventNames.bind(emitter),
            _subsystems: {
                api: {
                    on: jest.fn(),
                    removeAllListeners: jest.fn(),
                    eventNames: jest.fn().mockReturnValue([]),
                },
            },
        };

        statusUpdater = {
            metroCore: metroCore,
            processor: {
                _queueUpdate: jest.fn(),
                _generateUpdateId: jest.fn().mockReturnValue('mock-update-id'),
            },
            on: jest.fn(),
            emit: jest.fn(),
            removeAllListeners: jest.fn(),
        };

        listener = new UpdateListener(statusUpdater);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should queue a status_report update when a STATUS_REPORT event is received', async () => {
        listener.setupEventListeners();

        const mockReport = {
            system: {
                network: { status: 'operational' },
            },
        };

        metroCore.emit(EventRegistry.STATUS_REPORT, { type: EventRegistry.STATUS_REPORT, data: mockReport });

        await new Promise(resolve => setTimeout(resolve, 100));

        expect(statusUpdater.processor._queueUpdate).toHaveBeenCalledWith(
            'mock-update-id',
            expect.objectContaining({
                type: 'status_report',
                data: mockReport,
            })
        );
    });
});
