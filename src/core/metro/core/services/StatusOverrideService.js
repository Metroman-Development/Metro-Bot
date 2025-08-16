class StatusOverrideService {
    constructor(dbManager) {
        if (!dbManager) {
            throw new Error('StatusOverrideService requires a dbManager instance.');
        }
        this.dbManager = dbManager;
    }

    async addOverride({ targetType, targetId, status, message, source, expiresAt }) {
        try {
            const query = `
                INSERT INTO status_overrides (target_type, target_id, status, message, source, expires_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            await this.dbManager.query(query, [targetType, targetId, status, message, source, expiresAt]);
            console.log(`Added override for ${targetType} ${targetId}`);
        } catch (err) {
            console.error(`Could not add override: ${err.message}`);
            throw err;
        }
    }

    async getActiveOverrides() {
        try {
            const query = `
                SELECT * FROM status_overrides
                WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > NOW())
            `;
            const overrides = await this.dbManager.query(query);
            return overrides;
        } catch (err) {
            console.error(`Could not get active overrides: ${err.message}`);
            throw err;
        }
    }

    async removeOverride({ targetType, targetId, source }) {
        try {
            const query = `
                DELETE FROM status_overrides
                WHERE target_type = ? AND target_id = ? AND source = ?
            `;
            await this.dbManager.query(query, [targetType, targetId, source]);
            console.log(`Removed override for ${targetType} ${targetId}`);
        } catch (err) {
            console.error(`Could not remove override: ${err.message}`);
            throw err;
        }
    }

    applyOverrides(data, overrides) {
        if (!data || !overrides || !data.lineas) {
            return data;
        }

        // Deep copy to avoid modifying the original object
        const dataWithOverrides = JSON.parse(JSON.stringify(data));

        for (const override of overrides) {
            const { target_type, target_id, status, message } = override;

            if (target_type === 'line') {
                const lineKey = target_id.toLowerCase();
                if (dataWithOverrides.lineas[lineKey]) {
                    console.log(`Applying line override for ${lineKey}: status ${status}`);
                    dataWithOverrides.lineas[lineKey].estado = status;
                    dataWithOverrides.lineas[lineKey].mensaje = message;
                    dataWithOverrides.lineas[lineKey].mensaje_app = message;
                }
            } else if (target_type === 'station') {
                const stationCode = target_id.toUpperCase();
                // Iterate over all lines to find the station
                for (const line of Object.values(dataWithOverrides.lineas)) {
                    const station = line.estaciones?.find(s => s.codigo.toUpperCase() === stationCode);
                    if (station) {
                        console.log(`Applying station override for ${stationCode}: status ${status}`);
                        station.estado = status;
                        station.descripcion = message;
                        station.descripcion_app = message;
                        break; // Stop searching once found
                    }
                }
            } else if (target_type === 'system') {
                // System override is tricky as it applies to the processed data structure.
                // This part might need to be handled after initial processing.
                // For now, we can add a custom property to be picked up later.
                dataWithOverrides.system_override = { status, message };
            }
        }

        return dataWithOverrides;
    }
}

module.exports = StatusOverrideService;