const mariadb = require('mariadb');

async function verify() {
    let conn;
    try {
        conn = await mariadb.createConnection({
            host: '127.0.0.1',
            user: 'metroapi',
            password: 'Metro256',
            database: 'MetroDB'
        });

        const station = await conn.query("SELECT * FROM metro_stations WHERE station_name = 'Plaza de Puente Alto'");
        if (station.length > 0) {
            console.log("Station 'Plaza de Puente Alto' found.");
            console.log("Commerce details:", station[0].commerce);
            if (station[0].commerce) {
                console.log("Verification successful: Commerce details are present.");
            } else {
                console.error("Verification failed: Commerce details are missing.");
            }
        } else {
            console.error("Verification failed: Station 'Plaza de Puente Alto' not found.");
        }
    } catch (err) {
        console.error("An error occurred:", err);
    } finally {
        if (conn) conn.end();
    }
}

verify();
