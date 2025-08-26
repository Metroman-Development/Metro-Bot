// src/core/status/ChangeDetector.js

class MyChangeDetector {
    detect(oldData, newData) {
        const changes = [];

        if (!oldData || !newData) {
            return changes;
        }

        // Compare lines
        for (const lineId in newData.lines) {
            const oldLine = oldData.lines[lineId];
            const newLine = newData.lines[lineId];

            if (!oldLine || JSON.stringify(oldLine.status) !== JSON.stringify(newLine.status)) {
                changes.push({
                    type: 'line',
                    id: lineId,
                    from: oldLine ? oldLine.status : null,
                    to: newLine.status,
                });
            }
        }

        // Compare stations
        for (const stationId in newData.stations) {
            const oldStation = oldData.stations[stationId];
            const newStation = newData.stations[stationId];

            if (!oldStation || JSON.stringify(oldStation.status) !== JSON.stringify(newStation.status)) {
                changes.push({
                    type: 'station',
                    id: stationId,
                    line: newStation.line_id,
                    from: oldStation ? oldStation.status : null,
                    to: newStation.status,
                });
            }
        }

        return changes;
    }
}

module.exports = MyChangeDetector;
