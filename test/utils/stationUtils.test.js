const { decorateStation } = require('../../src/utils/stationUtils');
const { MetroInfoProvider } = require('../../src/utils/MetroInfoProvider');

jest.mock('../../src/utils/MetroInfoProvider', () => {
    const mockInstance = {
        getConfig: jest.fn().mockReturnValue({
            statusTypes: {
                '1': { discordem: '✅', name: 'abierta', isOperational: true },
                '5': { discordem: '❌', name: 'cerrada', isOperational: false },
                'default': { discordem: '❓' }
            },
            linesEmojis: {
                'l1': '1️⃣'
            },
            connectionEmojis: {
                'bus': '🚌'
            },
            routeStyles: {
                'roja': { emoji: '🔴' }
            },
            platformStatusIcons: {
                'ok': '🟢'
            }
        }),
    };
    return {
        MetroInfoProvider: {
            getInstance: jest.fn().mockReturnValue(mockInstance)
        }
    };
});

describe('decorateStation', () => {
    let metroInfoProvider;

    beforeEach(() => {
        metroInfoProvider = MetroInfoProvider.getInstance();
    });

    it('should not throw an error when transports is null', () => {
        const station = {
            name: 'Test Station',
            transports: null,
        };
        const decorations = ['transports'];

        expect(() => decorateStation(station, decorations, metroInfoProvider)).not.toThrow();
    });

    it('should not throw an error when transports is undefined', () => {
        const station = {
            name: 'Test Station',
        };
        const decorations = ['transports'];

        expect(() => decorateStation(station, decorations, metroInfoProvider)).not.toThrow();
    });

    it('should correctly decorate a station with transports', () => {
        const station = {
            name: 'Test Station',
            transports: 'Bus, Taxi',
        };
        const decorations = ['transports'];

        // Mock the normalizedConnectionEmojis for this test case
        metroInfoProvider.getConfig.mockReturnValueOnce({
            ...metroInfoProvider.getConfig(),
            connectionEmojis: {
                'bus': '🚌',
                'taxi': '🚕'
            }
        });

        const decoratedName = decorateStation(station, decorations, metroInfoProvider);
        expect(decoratedName).toContain('🚌');
    });
});
