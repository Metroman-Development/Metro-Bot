const ChangeAnnouncer = require('../../../src/core/status/ChangeAnnouncer');
const sinon = require('sinon');
const { EmbedBuilder } = require('discord.js');
const metroConfig = require('../../../src/config/metro/metroConfig');

describe('ChangeAnnouncer', () => {
    let changeAnnouncer;

    const mockAllStations = {
        lines: {
            l1: {
                displayName: 'Línea 1',
                color: '#ff0000',
                stations: ['pajaritos', 'los-heroes', 'baquedano', 'los-dominicos']
            }
        },
        stations: {
            'pajaritos': { displayName: 'Pajaritos', name: 'Pajaritos', status: { code: 1 } },
            'los-heroes': { displayName: 'Los Héroes', name: 'Los Héroes', status: { code: 1 } },
            'baquedano': { displayName: 'Baquedano', name: 'Baquedano', status: { code: 1 } },
            'los-dominicos': { displayName: 'Los Dominicos', name: 'Los Dominicos', status: { code: 1 } }
        }
    };

    beforeEach(() => {
        changeAnnouncer = new ChangeAnnouncer();
        // Mock metroConfig to avoid dependency on the actual config file
        metroConfig.statusTypes = {
            '0': { emoji: '⚪', description: 'Cerrada por horario' },
            '1': { emoji: '✅', description: 'Operativa', victoryEmoji: '🎉' },
            '2': { emoji: '❌', description: 'Cerrada' },
            '3': { emoji: '🟡', description: 'Servicio interrumpido' },
            '4': { emoji: '🟠', description: 'Con demoras' },
            '5': { emoji: '🔵', description: 'Servicio extendido' },
            '8': { emoji: '🔵', description: 'Servicio extendido' },
            '12': { emoji: '🟠', description: 'Con demoras' }
        };
        metroConfig.linesEmojis = { 'l1': '1️⃣' };
        metroConfig.metroLogo = { principal: 'https://example.com/logo.png' };
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('generateMessages', () => {
        it('should return an info embed when there are no changes', async () => {
            const changes = [];
            const { discord: messages } = await changeAnnouncer.generateMessages(changes, mockAllStations);
            expect(messages.length).toBe(1);
            const embed = messages[0];
            expect(embed.data.title).toBe('ℹ️ Información del Sistema');
            expect(embed.data.description).toBe('No hay cambios para anunciar');
        });

        it('should generate a message for a single station closure', async () => {
            const changes = [{
                type: 'station',
                id: 'baquedano',
                line: 'l1',
                from: 1,
                to: 2,
                reason: 'Manifestación en el exterior'
            }];
            const { discord: messages } = await changeAnnouncer.generateMessages(changes, mockAllStations);
            expect(messages.length).toBe(1);
            const embed = messages[0];
            expect(embed.data.title).toBe('1️⃣ Línea 1 (No todas las estaciones operativas)');
            const stationField = embed.data.fields.find(f => f.name.includes('Cambio de estado: Baquedano'));
            expect(stationField).toBeDefined();
            expect(stationField.value).toContain('**Estado actual:** Cerrada');
            expect(stationField.value).toContain('**Estado anterior:** Operativa');
        });

        it('should generate a message for a line status change', async () => {
            const changes = [{
                type: 'line',
                id: 'l1',
                from: 1,
                to: 4,
                reason: 'Tren con falla técnica'
            }];
            const { discord: messages } = await changeAnnouncer.generateMessages(changes, mockAllStations);
            expect(messages.length).toBe(1);
            const embed = messages[0];
            expect(embed.data.title).toBe('1️⃣ Línea 1');
            expect(embed.data.description).toBe('**Demoras en Línea**');
            const reasonField = embed.data.fields.find(f => f.name === '📌 Motivo');
            expect(reasonField).toBeDefined();
            expect(reasonField.value).toBe('Tren con falla técnica');
        });

        it('should generate a victory message when a line returns to normal operation', async () => {
            const changes = [{
                type: 'line',
                id: 'l1',
                from: 4,
                to: 1
            }];
            const { discord: messages } = await changeAnnouncer.generateMessages(changes, mockAllStations);
            expect(messages.length).toBe(1);
            const embed = messages[0];
            expect(embed.data.title).toBe('1️⃣ Línea 1');
            expect(embed.data.description).toContain('🎉 **Línea Operativa Nuevamente** 🎉');
            expect(embed.data.description).toContain('¡Las demoras han finalizado y el servicio es normal! 🚄');
        });

        it('should group consecutive station closures', async () => {
            const changes = [
                { type: 'station', id: 'los-heroes', line: 'l1', from: 1, to: 2 },
                { type: 'station', id: 'baquedano', line: 'l1', from: 1, to: 2 }
            ];
            const { discord: messages } = await changeAnnouncer.generateMessages(changes, mockAllStations);
            expect(messages.length).toBe(1);
            const embed = messages[0];
            const stationField = embed.data.fields.find(f => f.name.includes('Tramo afectado'));
            expect(stationField).toBeDefined();
            expect(stationField.name).toContain('Los Héroes → Baquedano');
            expect(stationField.name).toContain('2 estaciones');
        });
    });
});
