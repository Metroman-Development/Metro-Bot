const EmbedManager = require('../src/core/status/embeds/EmbedManager');
const logger = require('../src/events/logger');

// Mock the logger to prevent console output during tests
jest.mock('../src/events/logger', () => ({
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
}));

describe('EmbedManager', () => {
    let embedManager;
    let mockStatusUpdater;

    beforeEach(() => {
        // Reset mocks before each test
        logger.warn.mockClear();
        logger.debug.mockClear();

        mockStatusUpdater = {
            metroCore: {
                api: {
                    getProcessedData: jest.fn(),
                },
            },
            UI_STRINGS: {
                EMBEDS: {
                    UPDATE_FAILED: 'Update failed: {type}',
                    OVERVIEW_UPDATE: 'Updating overview',
                },
            },
            emit: jest.fn(),
        };
        embedManager = new EmbedManager(mockStatusUpdater);
        embedManager.embedMessages.set('l1', { edit: jest.fn() });
        embedManager.embedMessages.set('overview', { edit: jest.fn() });
    });

    describe('updateAllLineEmbeds', () => {
        it('should handle null data without crashing', async () => {
            await embedManager.updateAllLineEmbeds(null);
            expect(logger.warn).toHaveBeenCalledWith('[EmbedManager] updateAllLineEmbeds called without line data. Skipping.');
        });

        it('should handle data with null lines without crashing', async () => {
            const data = { lines: null };
            await embedManager.updateAllLineEmbeds(data);
            expect(logger.warn).toHaveBeenCalledWith('[EmbedManager] updateAllLineEmbeds called without line data. Skipping.');
        });

        it('should handle data with undefined lines without crashing', async () => {
            const data = {};
            await embedManager.updateAllLineEmbeds(data);
            expect(logger.warn).toHaveBeenCalledWith('[EmbedManager] updateAllLineEmbeds called without line data. Skipping.');
        });

        it('should call updateLineEmbed for each line', async () => {
            const data = {
                lines: {
                    l1: { id: 'L1' },
                },
                stations: {},
            };
            embedManager.updateLineEmbed = jest.fn();
            await embedManager.updateAllLineEmbeds(data);
            expect(embedManager.updateLineEmbed).toHaveBeenCalledWith({ id: 'L1' });
        });
    });

    describe('updateOverviewEmbed', () => {
        it('should not fetch new data if data is provided', async () => {
            const data = {
                lines: {
                    l1: { id: 'L1', status: 1, message: 'Normal', stations: [] },
                },
            };
            embedManager.areEmbedsReady = true;

            await embedManager.updateOverviewEmbed(data);
            // Verify that getProcessedData was NOT called
            expect(mockStatusUpdater.metroCore.api.getProcessedData).not.toHaveBeenCalled();
        });
    });

    describe('updateAllEmbeds', () => {
        beforeEach(() => {
            embedManager.areEmbedsReady = true;
            embedManager.updateOverviewEmbed = jest.fn();
            embedManager.updateAllLineEmbeds = jest.fn();
        });

        it('should call updateOverviewEmbed and updateAllLineEmbeds with the provided data', async () => {
            const data = {
                lines: { l1: { id: 'L1' } },
                stations: {},
            };

            await embedManager.updateAllEmbeds(data);

            expect(embedManager.updateOverviewEmbed).toHaveBeenCalledWith(data, null);
            expect(embedManager.updateAllLineEmbeds).toHaveBeenCalledWith(data);
        });

        it('should log an error and not proceed if no data is provided', async () => {
            await embedManager.updateAllEmbeds(null);

            expect(logger.error).toHaveBeenCalledWith('[EmbedManager] Failed to get processed data. Aborting update.');
            expect(embedManager.updateOverviewEmbed).not.toHaveBeenCalled();
            expect(embedManager.updateAllLineEmbeds).not.toHaveBeenCalled();
        });
    });
});
