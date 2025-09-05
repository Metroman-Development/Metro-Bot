const { lineEmbed } = require('../../src/config/statusEmbeds');
const { MetroInfoProvider } = require('../../src/utils/MetroInfoProvider');

jest.mock('../../src/utils/MetroInfoProvider', () => {
    const mockInstance = {
        getLine: jest.fn(),
        getStations: jest.fn(),
        getConfig: jest.fn().mockReturnValue({
            statusTypes: {
                'operational': { emoji: '✅', name: 'operational', isOperational: true, description: 'Servicio normal' },
                'closed': { emoji: '❌', name: 'closed', isOperational: false, description: 'Cerrada' },
                'default': { emoji: '❓' }
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

    it('should show "Servicio normal" when the line is operational', () => {
        const lineId = 'l1';
        const lineData = {
            id: 'l1',
            name: 'Línea 1',
            displayName: 'Línea 1',
            status_data: {
                status_name: 'operational',
                status_description: 'Servicio normal'
            }
        };
        const stations = {
            'ST1': { line_id: 'l1', status_data: { is_operational: 1, status_name: 'operational' } },
            'ST2': { line_id: 'l1', status_data: { is_operational: 1, status_name: 'operational' } },
        };

        metroInfoProvider.getLine.mockReturnValue(lineData);
        metroInfoProvider.getStations.mockReturnValue(stations);

        const embed = lineEmbed(lineId, metroInfoProvider, 'timestamp');
        expect(embed.description).toContain('Servicio normal');
    });

    it('should show the line status correctly even if some stations are not operational', () => {
        const lineId = 'l1';
        const lineData = {
            id: 'l1',
            name: 'Línea 1',
            displayName: 'Línea 1',
            status_data: {
                status_name: 'operational',
                status_description: 'Servicio normal'
            }
        };
        const stations = {
            'ST1': { line_id: 'l1', status_data: { is_operational: 1, status_name: 'operational' } },
            'ST2': { line_id: 'l1', status_data: { is_operational: 0, status_name: 'closed' } },
        };

        metroInfoProvider.getLine.mockReturnValue(lineData);
        metroInfoProvider.getStations.mockReturnValue(stations);

        const embed = lineEmbed(lineId, metroInfoProvider, 'timestamp');
        expect(embed.description).toContain('Servicio normal');
    });
});
