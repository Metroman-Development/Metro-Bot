require('dotenv').config();
const path = require('path');
const schedule = require('node-schedule');
const MetroCore = require('./src/core/metro/core/MetroCore');

/**
 * Updates the database with the provided station data.
 * @param {object} station - The station object from Metrocore.
 * @param {object} dbService - The database service instance from Metrocore.
 */
async function updateStationInDb(station, dbService) {
    // 1. Validate data
    if (!station.commune || !station.status) {
        console.warn(`[Data Loader] Skipping station ${station.station_code} due to missing 'commune' or 'status' data.`);
        return;
    }

    // 2. Update metro_stations table
    const stationQuery = `
        INSERT INTO metro_stations (
            line_id, station_code, station_name, display_name, display_order,
            commune, address, latitude, longitude, location,
            transports, services, accessibility, commerce, amenities, image_url, access_details
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, POINT(?, ?), ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            station_name = VALUES(station_name),
            display_name = VALUES(display_name),
            display_order = VALUES(display_order),
            commune = VALUES(commune),
            address = VALUES(address),
            latitude = VALUES(latitude),
            longitude = VALUES(longitude),
            location = VALUES(location),
            transports = VALUES(transports),
            services = VALUES(services),
            accessibility = VALUES(accessibility),
            commerce = VALUES(commerce),
            amenities = VALUES(amenities),
            image_url = VALUES(image_url),
            access_details = VALUES(access_details)
    `;

    // Ensure longitude and latitude are valid numbers, otherwise default to 0 for POINT
    const longitude = parseFloat(station.longitude);
    const latitude = parseFloat(station.latitude);
    const validPoint = !isNaN(longitude) && !isNaN(latitude);

    await dbService.db.query(stationQuery, [
        station.line_id, station.station_code, station.station_name, station.display_name || station.station_name, station.display_order || null,
        station.commune, station.address || null, station.latitude || null, station.longitude || null,
        validPoint ? longitude : 0, validPoint ? latitude : 0,
        station.transports || null, station.services || null, station.accessibility || null, station.commerce || null, station.amenities || null, station.image_url || null,
        station.access_details ? JSON.stringify(station.access_details) : null
    ]);
    console.log(`[Data Loader] Upserted station ${station.station_name}`);

    // 3. Update station_status table
    if (station.status && station.status.code) {
        await dbService.updateStationStatus(
            station.station_code,
            station.line_id,
            station.status.code,
            station.status.description,
            station.status.message
        );
        console.log(`[Data Loader] Updated status for station ${station.station_name}`);
    }

    // 4. Update accessibility_status table
    if (station.access_details && Array.isArray(station.access_details)) {
        for (const item of station.access_details) {
            await dbService.updateAccessibilityStatus(
                item.equipment_id,
                item.station_code,
                item.line_id,
                item.status,
                item.type,
                item.text
            );
        }
        console.log(`[Data Loader] Updated accessibility for station ${station.station_name}`);
    }
}


async function runUpdate() {
    console.log('[Data Loader] Running data update job...');
    try {
        console.log('[Data Loader] Getting Metrocore instance...');
        const metro = await MetroCore.getInstance();
        const dbService = metro._subsystems.dbService;

        console.log('[Data Loader] Metrocore instance obtained. Waiting for 30 seconds...');
        await new Promise(resolve => setTimeout(resolve, 30000));

        let data;
        for (let i = 0; i < 3; i++) {
            console.log(`[Data Loader] Getting current data from Metrocore (Attempt ${i + 1})...`);
            data = await metro.getCurrentData();
            if (data && data.lines && Object.keys(data.lines).length > 0) {
                console.log('[Data Loader] Data received successfully.');
                break;
            }
            console.log('[Data Loader] Incomplete data received. Retrying in 10 seconds...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            data = null; // Reset data to ensure loop condition is checked correctly
        }

        if (data) {
            console.log('[Data Loader] Starting database update process...');
            for (const lineId in data.lines) {
                const line = data.lines[lineId];
                if (line.stations && Array.isArray(line.stations)) {
                    for (const station of line.stations) {
                        await updateStationInDb(station, dbService);
                    }
                }
            }
            console.log('[Data Loader] Database update process complete.');
        } else {
            console.error('[Data Loader] Failed to get complete data from Metrocore after multiple retries.');
        }

    } catch (err) {
        console.error('[Data Loader] An error occurred during the update process:', err);
    }
}

// Schedule the script to run every 5 minutes
schedule.scheduleJob('*/5 * * * *', () => {
    runUpdate();
});

console.log('[Data Loader] Data loader scheduled to run every 5 minutes.');
runUpdate(); // Run once on startup
