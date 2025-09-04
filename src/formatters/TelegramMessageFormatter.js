const { getLineColor } = require('../utils/metroUtils');

class TelegramMessageFormatter {
    _enrichStationData(station) {
        let transferLines = [];
        let connections = station.connections;
        if (typeof connections === 'string') {
            try {
                connections = JSON.parse(connections);
            } catch (e) {
                connections = null;
            }
        }

        if (Array.isArray(connections)) {
            transferLines.push(...connections);
        }

        if (station.transfer) {
            transferLines.push(station.transfer);
        }

        const uniqueTransferLines = [...new Set(transferLines)];

        return {
            ...station,
            id: station.id,
            displayName: station.displayName || 'Unknown Station',
            line: station.line || 'L0',
            transferLines: uniqueTransferLines,
            color: station.color || getLineColor(station.line),
        };
    }

    formatStationInfo(station, metroInfoProvider) {
        if (!station) {
            return "No se encontró la estación especificada.";
        }

        const enrichedStation = this._enrichStationData(station);

        let message = `*Información de la Estación: ${enrichedStation.displayName}*\n\n`;
        message += `*Línea:* ${enrichedStation.line}\n`;
        message += `*Estado:* ${enrichedStation.status?.description || 'No disponible'}\n\n`;

        message += `*Comuna:* ${enrichedStation.commune || 'No disponible'}\n`;
        message += `*Dirección:* ${enrichedStation.address || 'No disponible'}\n\n`;

        if (enrichedStation.transferLines && enrichedStation.transferLines.length > 0) {
            message += `*Combinaciones:* ${enrichedStation.transferLines.join(', ')}\n`;
        }

        if (enrichedStation.services) {
            let services = [];
            try {
                services = JSON.parse(enrichedStation.services);
            } catch (e) {
                // ignore
            }
            if(services.length > 0) {
                message += `*Servicios:* ${services.join(', ')}\n`;
            }
        }

        if (enrichedStation.accessibility) {
            message += `*Accesibilidad:* ${enrichedStation.accessibility.replace(/\n/g, ', ')}\n`;
        }


        return message;
    }
}

module.exports = TelegramMessageFormatter;
