const EmbedManager = require('../src/core/status/embeds/EmbedManager');
const logger = require('../src/events/logger');

const MetroInfoProvider = require('../src/utils/MetroInfoProvider');

// Mock the logger to prevent console output during tests
jest.mock('../src/events/logger', () => ({
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
}));

jest.mock('../src/utils/MetroInfoProvider', () => ({
    getFullData: jest.fn(),
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
                getCurrentData: jest.fn(),
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

        it('should call updateLineEmbed for each line with stations data', async () => {
            const data = {
                lines: {
                    l1: { id: 'L1' },
                },
                stations: { 'ST1': { id: 'ST1', name: 'Station 1' } },
            };
            embedManager.updateLineEmbed = jest.fn();
            await embedManager.updateAllLineEmbeds(data);
            expect(embedManager.updateLineEmbed).toHaveBeenCalledWith(data.lines.l1, data.stations);
        });
    });

    describe('updateOverviewEmbed', () => {
        it('should not fetch new data if data is provided', async () => {
            const data = {
                lines: {
                    l1: { id: 'L1', status: 1, message: 'Normal', stations: [] },
                },
                systemMetadata: {
                    status: 'operational'
                }
            };
            embedManager.areEmbedsReady = true;

            await embedManager.updateOverviewEmbed(data);
            // Verify that getCurrentData was NOT called
            expect(mockStatusUpdater.metroCore.getCurrentData).not.toHaveBeenCalled();
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
                systemMetadata: {
                    status: 'operational'
                }
            };

            await embedManager.updateAllEmbeds(data);

            expect(embedManager.updateOverviewEmbed).toHaveBeenCalledWith(data, null);
            expect(embedManager.updateAllLineEmbeds).toHaveBeenCalledWith(data);
        });

        it('should use systemMetadata for network status', async () => {
            const data = {
                lines: { l1: { id: 'L1' } },
                stations: {},
                systemMetadata: {
                    status: 'degraded'
                }
            };

            await embedManager.updateAllEmbeds(data);

            expect(embedManager.updateOverviewEmbed).toHaveBeenCalledWith(data, null);
        });

        it('should log an error and not proceed if no data is provided', async () => {
            MetroInfoProvider.getFullData.mockReturnValue(null);
            await embedManager.updateAllEmbeds(null);

            expect(logger.error.mock.calls[0][0]).toBe('[EmbedManager] Failed to get processed data or data is incomplete. Aborting update.');
            expect(embedManager.updateOverviewEmbed).not.toHaveBeenCalled();
            expect(embedManager.updateAllLineEmbeds).not.toHaveBeenCalled();
        });
    });
});
