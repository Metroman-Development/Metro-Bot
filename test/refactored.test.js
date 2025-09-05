const { MetroInfoProvider } = require('../src/utils/MetroInfoProvider');
const { overviewEmbed, lineEmbed } = require('../src/config/statusEmbeds');
const { decorateStation, processCommerceText, processAccessibilityText } = require('../src/utils/stationUtils');
const { decorateStation: decorateStationStringUtils, getLineEmoji, getStatusEmoji: getStatusEmojiStringUtils } = require('../src/utils/stringUtils');

jest.mock('../src/utils/MetroInfoProvider');

describe('Refactored Code Tests', () => {
    let metroInfoProvider;

    beforeEach(() => {
        metroInfoProvider = new MetroInfoProvider();
        metroInfoProvider.getConfig.mockReturnValue({
            linesEmojis: {
                l1: '1️⃣',
                l2: '2️⃣',
            },
            statusTypes: {
                '1': {
                    emoji: '✅',
                    description: 'Operativa',
                    discordem: '✅'
                },
                '5': {
                    emoji: '🌙',
                    description: 'Cierre por Horario',
                    discordem: '🌙'
                },
                'default': {
                    emoji: '❓',
                    description: 'Estado desconocido',
                    discordem: '❓'
                }
            },
            routeStyles: {
                roja: {
                    emoji: '🔴'
                }
            },
            commerce: {
                'store': '🏪'
            },
            accessibility: {
                estado: {
                    ope: '✅'
                },
                ascensor: '🛗'
            },
            connectionEmojis: {
                bus: '🚌'
            }
        });
    });

    describe('stationUtils', () => {
        it('should decorate station name correctly', () => {
            const station = {
                display_name: 'Test Station',
                is_operational: 1,
                express_state: 'Operational',
                route_color: 'R',
                transfer: 'l2',
                transports: 'bus'
            };
            const decorations = ['line_connections', 'transports'];
            const decoratedName = decorateStation(station, decorations, metroInfoProvider);
            expect(decoratedName).toBe('✅ 🔴 Test Station 🔄 2️⃣ 🚌');
        });

        it('should process commerce text correctly', () => {
            const commerceText = 'store';
            const processedText = processCommerceText(commerceText, metroInfoProvider.getConfig());
            expect(processedText).toBe('🏪');
        });

        it('should process accessibility text correctly', () => {
            const accessibility = [
                { type: 'ascensor', text: 'Ascensor ABC', status: '1' },
                { type: 'escalator', text: 'Escalator XYZ', status: '0' }
            ];
            metroInfoProvider.getConfig.mockReturnValue({
                ...metroInfoProvider.getConfig(),
                accessibility: {
                    estado: {
                        ope: '✅',
                        fes: '⛔'
                    },
                    ascensor: '🛗',
                    escalator: ''
                }
            });
            const processedText = processAccessibilityText(accessibility, metroInfoProvider.getConfig());
            expect(processedText).toEqual([
                '⚠️ Algunos equipos de accesibilidad presentan problemas.',
                '✅ 🛗 Ascensor ABC',
                '⛔  Escalator XYZ'
            ]);
        });
    });

    describe('statusEmbeds', () => {
        it('should generate overview embed correctly', () => {
            metroInfoProvider.getFullData.mockReturnValue({
                lines: {
                    l1: {
                        id: 'l1',
                        displayName: 'Línea 1',
                        status: '1'
                    }
                },
                network_status: {
                    status: 'operational'
                }
            });
            const embed = overviewEmbed(metroInfoProvider, new Date().toISOString());
            expect(embed.title).toBe('🚇 Estado General de la Red Metro');
            expect(embed.description).toBe('✅ **Toda la Red Operativa**');
            expect(embed.fields[0].name).toBe('1️⃣ Línea 1');
        });

        it('should generate line embed correctly', () => {
            metroInfoProvider.getLine.mockReturnValue({
                id: 'l1',
                displayName: 'Línea 1',
                status: '1'
            });
            metroInfoProvider.getStations.mockReturnValue({
                'ST1': {
                    id: 'ST1',
                    name: 'Test Station',
                    line_id: 'l1',
                    is_operational: 1,
                    transports: ''
                }
            });
            const embed = lineEmbed('l1', metroInfoProvider, new Date().toISOString());
            expect(embed.title).toBe('1️⃣ Línea 1');
            expect(embed.fields[0].value).toContain('Test Station');
        });
    });

    describe('stringUtils', () => {
        it('should decorate station name correctly', async () => {
            metroInfoProvider.getFullData.mockReturnValue({
                stations: {
                    'l1': {
                        'Test Station': {
                            transfer: []
                        }
                    }
                }
            });
            const decoratedName = await decorateStationStringUtils('Test Station', { line: 'l1', status: '1' }, metroInfoProvider);
            expect(decoratedName.trim()).toBe('✅ Test Station');
        });

        it('should get line emoji correctly', () => {
            const emoji = getLineEmoji('l1', metroInfoProvider);
            expect(emoji).toBe('1️⃣');
        });

        it('should get status emoji correctly', () => {
            const emoji = getStatusEmojiStringUtils('1', metroInfoProvider);
            expect(emoji).toBe('✅');
        });
    });
});
