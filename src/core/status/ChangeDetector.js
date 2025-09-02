// src/core/status/ChangeDetector.js
const { diff } = require('deep-diff');

class MyChangeDetector {
  constructor(changeAnnouncer) {
    this.unprocessedChanges = new Set();
    this.changeAnnouncer = changeAnnouncer;
  }

  detect(oldData, newData) {
    const changes = [];

    if (!oldData || !newData) {
      return [];
    }

        // Compare network status
        if (JSON.stringify(oldData.network) !== JSON.stringify(newData.network)) {
            changes.push({
                type: 'network',
                id: 'network-status',
                from: oldData.network,
                to: newData.network,
                details: diff(oldData.network, newData.network)
            });
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

        const detailedDifferences = diff(oldData, newData);
        if (detailedDifferences) {
            changes.push({
                type: 'deep_diff',
                id: 'detailed-changes',
                from: null,
                to: null,
                details: detailedDifferences.filter(d => {
                    // Filter out changes that are already covered by the specific checks above
                    const path = d.path.join('.');
                    return !path.startsWith('network') && !path.includes('status');
                })
            });
        }

        this.unprocessedChanges = new Set([...this.unprocessedChanges, ...changes]);
    }

    processChanges(allStations) {
      if (this.unprocessedChanges.size > 0) {
        const changesToProcess = [...this.unprocessedChanges];
        this.unprocessedChanges.clear();
        this.changeAnnouncer.generateMessages(changesToProcess, allStations);
      }
    }
}

module.exports = MyChangeDetector;
