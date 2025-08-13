class TelegramMessageFormatter {
    formatStationInfo(station) {
        if (!station) {
            return "No se encontró la estación especificada.";
        }

        let message = `*Información de la Estación: ${station.displayName}*\n\n`;
        message += `*Línea:* ${station.line}\n`;
        message += `*Estado:* ${station.status?.description || 'No disponible'}\n`;

        return message;
    }
}

module.exports = TelegramMessageFormatter;
