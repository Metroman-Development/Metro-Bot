const logger = require('../../../../events/logger');

class StatusOverrideService {
    constructor(dbService) {
        if (!dbService) {
            throw new Error('StatusOverrideService requires a dbService instance.');
        }
        this.dbService = dbService;
    }

    async prepareEventOverrides(eventDetails) {
        logger.info("[StatusOverrideService] Preparing event overrides", { eventDetails });

        if (!eventDetails?.closedStations && !eventDetails?.operationalStations) return false;

        const currentRawData = await this.dbService.getDbRawData();
        const promises = [];

        // Prepare line overrides
        const allAffectedLines = new Set([
            ...Object.keys(eventDetails.closedStations || {}),
            ...Object.keys(eventDetails.operationalStations || {})
        ]);

        allAffectedLines.forEach(lineId => {
            const promise = this.addOverride({
                targetType: 'line',
                targetId: lineId.toLowerCase(),
                status: 5,
                message: `Servicio afectado por Evento: ${eventDetails.name}`,
                source: 'event',
                expiresAt: null // Or calculate an expiration date
            });
            promises.push(promise);
        });

        // Process closed stations
        if (eventDetails.closedStations) {
            Object.entries(eventDetails.closedStations).forEach(([lineId, stationNames]) => {
                const lineKey = lineId.toLowerCase();
                const lineData = currentRawData.lineas[lineKey];

                if (lineData && lineData.estaciones) {
                    stationNames.forEach(stationName => {
                        const station = lineData.estaciones.find(s =>
                            s.nombre.includes(stationName)
                        );

                        if (station) {
                            const promise = this.addOverride({
                                targetType: 'station',
                                targetId: station.codigo.toUpperCase(),
                                status: 5,
                                message: "Servicio Extendido Únicamente para Salida",
                                source: 'event',
                                expiresAt: null
                            });
                            promises.push(promise);
                        } else {
                            logger.warn(`[StatusOverrideService] Closed station "${stationName}" not found in line ${lineKey}`);
                        }
                    });
                } else {
                    logger.warn(`[StatusOverrideService] Line ${lineKey} not found in current data for closed stations`);
                }
            });
        }

        // Process operational stations
        if (eventDetails.operationalStations) {
            eventDetails.operationalStations.forEach(stationName => {
                let found = false;
                for (const [lineKey, lineData] of Object.entries(currentRawData.lineas)) {
                    if (lineKey.startsWith('l') && lineData.estaciones) {
                        const station = lineData.estaciones.find(s =>
                            s.nombre === stationName
                        );

                        if (station) {
                            const promise = this.addOverride({
                                targetType: 'station',
                                targetId: station.codigo.toUpperCase(),
                                status: 5,
                                message: "Servicio Extendido Únicamente para Entrada",
                                source: 'event',
                                expiresAt: null
                            });
                            promises.push(promise);
                            found = true;
                            break;
                        }
                    }
                }

                if (!found) {
                    logger.warn(`[StatusOverrideService] Operational station "${stationName}" not found in any line`);
                }
            });
        }

        await Promise.all(promises);
        logger.info("[StatusOverrideService] Event overrides prepared and stored in DB.");
        return true;
    }

    async addOverride({ targetType, targetId, status, message, source, expiresAt }) {
        try {
            const query = `
                INSERT INTO status_overrides (target_type, target_id, status, message, source, expires_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            await this.dbService.db.query(query, [targetType, targetId, status, message, source, expiresAt]);
            logger.info(`Added override for ${targetType} ${targetId}`);
        } catch (err) {
            logger.error(`Could not add override: ${err.message}`);
            throw err;
        }
    }

    async cleanupEventOverrides() {
        logger.info("[StatusOverrideService] Cleaning up event overrides");
        try {
            const query = `DELETE FROM status_overrides WHERE source = ?`;
            await this.dbService.db.query(query, ['event']);
            logger.info("[StatusOverrideService] Event overrides cleaned up.");
            return true;
        } catch (err) {
            logger.error(`Could not clean up event overrides: ${err.message}`);
            throw err;
        }
    }

    async getActiveOverrides() {
        try {
            const query = `
                SELECT * FROM status_overrides
                WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > NOW())
            `;
            const overrides = await this.dbService.db.query(query);
            return overrides;
        } catch (err) {
            logger.error(`Could not get active overrides: ${err.message}`);
            throw err;
        }
    }

    async removeOverride({ targetType, targetId, source }) {
        try {
            const query = `
                DELETE FROM status_overrides
                WHERE target_type = ? AND target_id = ? AND source = ?
            `;
            await this.dbService.db.query(query, [targetType, targetId, source]);
            logger.info(`Removed override for ${targetType} ${targetId}`);
        } catch (err) {
            logger.error(`Could not remove override: ${err.message}`);
            throw err;
        }
    }

    applyOverrides(data, overrides) {
        if (!data || !overrides) {
            return data;
        }

        const dataWithOverrides = JSON.parse(JSON.stringify(data));

        for (const override of overrides) {
            const { target_type, target_id, status, message } = override;

            if (target_type === 'line') {
                if (dataWithOverrides.lines && dataWithOverrides.lines[target_id]) {
                    dataWithOverrides.lines[target_id].status.code = status;
                    dataWithOverrides.lines[target_id].status.message = message;
                }
            } else if (target_type === 'station') {
                if (dataWithOverrides.stations && dataWithOverrides.stations[target_id]) {
                    dataWithOverrides.stations[target_id].status.code = status;
                    dataWithOverrides.stations[target_id].status.message = message;
                }
            } else if (target_type === 'system') {
                if (dataWithOverrides.network) {
                    dataWithOverrides.network.status = status;
                    dataWithOverrides.network.message = message;
                }
            }
        }

        return dataWithOverrides;
    }
}

module.exports = StatusOverrideService;