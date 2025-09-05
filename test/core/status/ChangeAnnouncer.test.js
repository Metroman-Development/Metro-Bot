const ChangeAnnouncer = require('../../../src/core/status/ChangeAnnouncer');
const metroConfig = require('../../../src/config/metro/metroConfig');

describe('ChangeAnnouncer', () => {
    let announcer;

    // Mock station data for all tests
    const mockAllStations = {
        lines: {
            l1: {
                displayName: 'Línea 1',
                color: '#ff0000',
                stations: ['L1-pajaritos', 'L1-los-heroes', 'L1-baquedano']
            }
        },
        stations: {
            'L1-pajaritos': { id: 'L1-pajaritos', lineId: 'l1', displayName: 'Pajaritos', name: 'Pajaritos' },
            'L1-los-heroes': { id: 'L1-los-heroes', lineId: 'l1', displayName: 'Los Héroes', name: 'Los Héroes' },
            'L1-baquedano': { id: 'L1-baquedano', lineId: 'l1', displayName: 'Baquedano', name: 'Baquedano' },
        }
    };

    beforeEach(() => {
        announcer = new ChangeAnnouncer();

        // Mock metroConfig to avoid dependency on the actual config file
        metroConfig.statusTypes = {
            '0': { emoji: '⚪', description: 'Cerrada por horario' },
            '1': { emoji: '✅', description: 'Operativa', victoryEmoji: '🎉' },
            '2': { emoji: '❌', description: 'Cerrada' },
            '3': { emoji: '🟡', description: 'Servicio interrumpido' },
            '4': { emoji: '🟠', description: 'Con demoras' },
            '5': { emoji: '❌', description: 'Cerrada' },
            '8': { emoji: '🔵', description: 'Servicio extendido' },
            '12': { emoji: '🟠', description: 'Con demoras' },
        };
        metroConfig.linesEmojis = { 'l1': '1️⃣' };
        metroConfig.metroLogo = { principal: 'https://example.com/logo.png' };
    });

    describe('Status Changes', () => {
        it('should return an info embed when there are no changes', async () => {
            const { discord: messages } = await announcer.generateMessages([], mockAllStations);
            expect(messages.length).toBe(1);
            const embed = messages[0];
            expect(embed.data.title).toBe('ℹ️ Información del Sistema');
            expect(embed.data.description).toBe('No hay cambios para anunciar');
        });

        it('should generate a message for a single station closure', async () => {
            const changes = [{ type: 'station', id: 'L1-baquedano', line: 'l1', from: 1, to: 2 }];
            const { discord: messages } = await announcer.generateMessages(changes, mockAllStations);
            expect(messages.length).toBe(1);
            const embed = messages[0].data;
            expect(embed.title).toContain('Línea 1');
            const stationField = embed.fields.find(f => f.name.includes('Cambio de estado: Baquedano'));
            expect(stationField).toBeDefined();
            expect(stationField.value).toContain('Estado actual:** Cerrada');
            expect(stationField.value).toContain('Estado anterior:** Operativa');
        });
    });

    describe('Accessibility Changes', () => {
        it('should generate a message for an accessibility change', async () => {
            const accessibilityChanges = [{
                type: 'accessibility',
                stationName: 'Pajaritos',
                line: 'l1',
                id: 'L1-pajaritos',
                changes: [{
                    equipment: 'Ascensor',
                    from: true,
                    to: false,
                }]
            }];

            const { discord: messages } = await announcer.generateMessages(accessibilityChanges, mockAllStations);

            expect(messages.length).toBe(1);
            const embed = messages[0].data;
            expect(embed.title).toBe('1️⃣ Línea 1');

            const accessibilityField = embed.fields.find(f => f.name === '♿ Cambios de Accesibilidad');
            expect(accessibilityField).toBeDefined();
            expect(accessibilityField.value).toContain('**Pajaritos**');
            expect(accessibilityField.value).toContain('• Ascensor: ✅ Disponible → ❌ No disponible');
        });

        it('should combine status and accessibility changes in one announcement', async () => {
            const allChanges = [
                { type: 'station', id: 'L1-baquedano', line: 'l1', from: 1, to: 2 },
                {
                    type: 'accessibility',
                    stationName: 'Pajaritos',
                    line: 'l1',
                    id: 'L1-pajaritos',
                    changes: [{ equipment: 'Ascensor', from: true, to: false }]
                }
            ];

            const { discord: messages } = await announcer.generateMessages(allChanges, mockAllStations);

            expect(messages.length).toBe(1);
            const embed = messages[0].data;

            // Check for station status field
            const stationField = embed.fields.find(f => f.name.includes('Cambio de estado: Baquedano'));
            expect(stationField).toBeDefined();

            // Check for accessibility field
            const accessibilityField = embed.fields.find(f => f.name === '♿ Cambios de Accesibilidad');
            expect(accessibilityField).toBeDefined();
            expect(accessibilityField.value).toContain('**Pajaritos**');
        });
    });
});
