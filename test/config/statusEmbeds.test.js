const { lineEmbed } = require('../../src/config/statusEmbeds');
const { MetroInfoProvider } = require('../../src/utils/MetroInfoProvider');

jest.mock('../../src/utils/MetroInfoProvider', () => {
    const mockInstance = {
        getLine: jest.fn(),
        getStations: jest.fn(),
        getConfig: jest.fn().mockReturnValue({
            statusTypes: {
                '1': { discordem: '✅', name: 'abierta', isOperational: true, description: 'Servicio normal' },
                '5': { discordem: '❌', name: 'cerrada', isOperational: false, description: 'Cerrada' },
                'default': { discordem: '❓' }
            },
            linesEmojis: {
                'l1': '1️⃣'
            },
        }),
    };
    return {
        MetroInfoProvider: {
            getInstance: jest.fn().mockReturnValue(mockInstance)
        }
    };
});

describe('lineEmbed', () => {
    let metroInfoProvider;

    beforeEach(() => {
        metroInfoProvider = MetroInfoProvider.getInstance();
    });

    it('should show "Servicio normal" when all stations are operational', () => {
        const lineId = 'l1';
        const lineData = { id: 'l1', name: 'Línea 1', displayName: 'Línea 1' };
        const stations = {
            'ST1': { line_id: 'l1', is_operational: 1, status_name: 'operational' },
            'ST2': { line_id: 'l1', is_operational: 1, status_name: 'operational' },
        };

        metroInfoProvider.getLine.mockReturnValue(lineData);
        metroInfoProvider.getStations.mockReturnValue(stations);

        const embed = lineEmbed(lineId, metroInfoProvider, 'timestamp');
        expect(embed.description).toContain('Servicio normal');
    });

    it('should show "Estado mixto" when some stations are not operational', () => {
        const lineId = 'l1';
        const lineData = { id: 'l1', name: 'Línea 1', displayName: 'Línea 1' };
        const stations = {
            'ST1': { line_id: 'l1', is_operational: 1, status_name: 'operational' },
            'ST2': { line_id: 'l1', is_operational: 0, status_name: 'closed' },
        };

        metroInfoProvider.getLine.mockReturnValue(lineData);
        metroInfoProvider.getStations.mockReturnValue(stations);

        const embed = lineEmbed(lineId, metroInfoProvider, 'timestamp');
        expect(embed.description).toContain('Estado mixto');
    });
});
