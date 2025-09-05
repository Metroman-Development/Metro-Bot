const DiscordMessageFormatter = require('../../src/formatters/DiscordMessageFormatter');
const { MetroInfoProvider } = require('../../src/utils/MetroInfoProvider');
const { EmbedBuilder } = require('discord.js');
const metroConfig = require('../../src/config/metro/metroConfig');

jest.mock('../../src/utils/MetroInfoProvider');

describe('DiscordMessageFormatter', () => {
    let metroInfoProvider;
    let formatter;

    beforeEach(() => {
        metroInfoProvider = new MetroInfoProvider();
        metroInfoProvider.getConfig.mockReturnValue(metroConfig);
        formatter = new DiscordMessageFormatter();
    });

    describe('_createAccessibilityEmbed', () => {
        it('should show summary for acc_summary tab', async () => {
            const station = {
                name: 'Test Station',
                color: '#FF0000',
                accessibility: [
                    { tipo: 'ascensor', texto: 'Ascensor 1', estado: 0 },
                    { tipo: 'escalera', texto: 'Escalera 1', estado: 1 },
                ],
            };
            const embed = await formatter._createAccessibilityEmbed(station, 'acc_summary');
            expect(embed.data.description).toContain('1** ascensores con problemas');
        });

        it('should show elevator details for acc_elevators tab', async () => {
            const station = {
                name: 'Test Station',
                color: '#FF0000',
                accessibility: [
                    { tipo: 'ascensor', texto: 'Ascensor 1', estado: 0 },
                    { tipo: 'escalera', texto: 'Escalera 1', estado: 1 },
                ],
            };
            const embed = await formatter._createAccessibilityEmbed(station, 'acc_elevators');
            expect(embed.data.title).toContain('Ascensores');
            expect(embed.data.fields[0].value).toContain('Ascensor 1');
            expect(embed.data.fields[0].value).toContain(metroConfig.accessibility.estado.fes);
        });

        it('should split long accessibility list into multiple fields', async () => {
            const accessibility = [];
            for (let i = 0; i < 20; i++) {
                accessibility.push({ tipo: 'ascensor', texto: `Ascensor largo texto ${i}`.repeat(10), estado: 1 });
            }
            const station = {
                name: 'Test Station',
                color: '#FF0000',
                accessibility: accessibility,
            };
            const embed = await formatter._createAccessibilityEmbed(station, 'acc_elevators');
            expect(embed.data.fields.length).toBeGreaterThan(1);
        });
    });

    describe('_createTransfersEmbed', () => {
        it('should show transfers correctly', async () => {
            const station = {
                displayName: 'Test Station',
                color: '#FF0000',
                connections: ['L5', 'Bus', 'BiciMetro'],
            };
            const embed = await formatter._createTransfersEmbed(station);
            expect(embed.data.fields[0].name).toBe('Líneas de Metro');
            expect(embed.data.fields[0].value).toContain(metroConfig.linesEmojis.l5);
            expect(embed.data.fields[1].name).toBe('Otros Transportes');
            expect(embed.data.fields[1].value).toContain('Bus');
            expect(embed.data.fields[2].name).toBe('Bicicletas');
            expect(embed.data.fields[2].value).toContain('BiciMetro');
        });
    });
});
