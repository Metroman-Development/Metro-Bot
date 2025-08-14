require('dotenv').config();
const mariadb = require('mariadb');
const fs = require('fs').promises;
const path = require('path');

const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.METRODB_NAME,
    connectionLimit: 5,
    multipleStatements: true
});

async function ensureSchema(conn) {
    console.log('Ensuring database schema...');
    const queries = [
        `CREATE TABLE IF NOT EXISTS \`system_info\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`name\` varchar(255) NOT NULL,
          \`system\` varchar(255) DEFAULT NULL,
          \`inauguration\` varchar(255) DEFAULT NULL,
          \`length\` varchar(255) DEFAULT NULL,
          \`stations\` int(11) DEFAULT NULL,
          \`track_gauge\` varchar(255) DEFAULT NULL,
          \`electrification\` varchar(255) DEFAULT NULL,
          \`max_speed\` varchar(255) DEFAULT NULL,
          \`status\` varchar(255) DEFAULT NULL,
          \`lines\` int(11) DEFAULT NULL,
          \`cars\` int(11) DEFAULT NULL,
          \`passengers\` int(11) DEFAULT NULL,
          \`fleet\` varchar(255) DEFAULT NULL,
          \`average_speed\` varchar(255) DEFAULT NULL,
          \`operator\` varchar(255) DEFAULT NULL,
          \`map_url\` varchar(255) DEFAULT NULL,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;`,
        `CREATE TABLE IF NOT EXISTS \`metro_lines\` (
          \`line_id\` varchar(10) NOT NULL,
          \`line_name\` varchar(50) NOT NULL,
          \`line_color\` varchar(20) DEFAULT NULL,
          \`display_order\` int(11) DEFAULT NULL,
          \`line_description\` varchar(500) DEFAULT NULL,
          \`opening_date\` date DEFAULT NULL,
          \`total_stations\` int(11) DEFAULT NULL,
          \`total_length_km\` decimal(6,2) DEFAULT NULL,
          \`avg_daily_ridership\` int(11) DEFAULT NULL,
          \`operating_hours_start\` time DEFAULT NULL,
          \`operating_hours_end\` time DEFAULT NULL,
          \`created_at\` timestamp NULL DEFAULT current_timestamp(),
          \`updated_at\` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
          \`display_name\` varchar(100) GENERATED ALWAYS AS (concat('Línea ',ucase(substring(\`line_id\`, 2)))) VIRTUAL,
          \`fleet_data\` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(\`fleet_data\`)),
          \`status_code\` varchar(20) DEFAULT NULL,
          \`status_message\` varchar(500) DEFAULT NULL,
          \`app_message\` varchar(500) DEFAULT NULL,
          \`infrastructure\` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(\`infrastructure\`)),
          \`status_code_str\` varchar(20) GENERATED ALWAYS AS (ifnull(\`status_code\`,'')) VIRTUAL,
          PRIMARY KEY (\`line_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;`,
        `CREATE TABLE IF NOT EXISTS \`metro_stations\` (
          \`station_id\` int(11) NOT NULL AUTO_INCREMENT,
          \`line_id\` varchar(10) NOT NULL,
          \`station_code\` varchar(20) NOT NULL,
          \`station_name\` varchar(100) NOT NULL,
          \`display_order\` int(11) DEFAULT NULL,
          \`commune\` varchar(100) DEFAULT NULL,
          \`address\` varchar(255) DEFAULT NULL,
          \`latitude\` decimal(10,8) DEFAULT NULL,
          \`longitude\` decimal(11,8) DEFAULT NULL,
          \`location\` point NOT NULL,
          \`opened_date\` date DEFAULT NULL,
          \`last_renovation_date\` date DEFAULT NULL,
          \`created_at\` timestamp NULL DEFAULT current_timestamp(),
          \`updated_at\` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
          \`display_name\` varchar(100) DEFAULT NULL,
          \`transports\` text DEFAULT NULL,
          \`services\` text DEFAULT NULL,
          \`accessibility\` text DEFAULT NULL,
          \`commerce\` text DEFAULT NULL,
          \`amenities\` text DEFAULT NULL,
          \`image_url\` varchar(255) DEFAULT NULL,
          \`access_details\` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(\`access_details\`)),
          PRIMARY KEY (\`station_id\`),
          UNIQUE KEY \`line_id\` (\`line_id\`,\`station_code\`),
          CONSTRAINT \`metro_stations_ibfk_1\` FOREIGN KEY (\`line_id\`) REFERENCES \`metro_lines\` (\`line_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;`,
        `CREATE TABLE IF NOT EXISTS \`train_models\` (
          \`model_id\` varchar(50) NOT NULL,
          \`model_data\` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(\`model_data\`)),
          PRIMARY KEY (\`model_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;`,
        `CREATE TABLE IF NOT EXISTS \`line_fleet\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`line_id\` varchar(10) NOT NULL,
          \`model_id\` varchar(50) NOT NULL,
          \`last_updated\` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
          PRIMARY KEY (\`id\`),
          KEY \`idx_line_model\` (\`line_id\`,\`model_id\`),
          CONSTRAINT \`line_fleet_ibfk_1\` FOREIGN KEY (\`line_id\`) REFERENCES \`metro_lines\` (\`line_id\`),
          CONSTRAINT \`line_fleet_ibfk_2\` FOREIGN KEY (\`model_id\`) REFERENCES \`train_models\` (\`model_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;`,
        `CREATE TABLE IF NOT EXISTS \`intermodal_stations\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`name\` varchar(255) NOT NULL,
          \`services\` text DEFAULT NULL,
          \`location\` varchar(255) DEFAULT NULL,
          \`commune\` varchar(255) DEFAULT NULL,
          \`inauguration\` varchar(255) DEFAULT NULL,
          \`platforms\` varchar(255) DEFAULT NULL,
          \`operator\` varchar(255) DEFAULT NULL,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`name\` (\`name\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;`,
        `CREATE TABLE IF NOT EXISTS \`intermodal_buses\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`station_id\` int(11) NOT NULL,
          \`type\` varchar(255) DEFAULT NULL,
          \`route\` varchar(255) DEFAULT NULL,
          \`destination\` varchar(255) DEFAULT NULL,
          PRIMARY KEY (\`id\`),
          KEY \`station_id\` (\`station_id\`),
          CONSTRAINT \`intermodal_buses_ibfk_1\` FOREIGN KEY (\`station_id\`) REFERENCES \`intermodal_stations\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;`
    ];

    for (const query of queries) {
        try {
            await conn.query(query);
        } catch (err) {
            console.error(`Error executing query: ${query}`);
            console.error(err.message);
        }
    }
    console.log('Schema check finished.');
}


async function correctStationCodes(conn) {
    console.log('Correcting station codes...');
    const stationsData = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/stations.json'), 'utf8'));

    for (const lineId in stationsData) {
        const lineStations = stationsData[lineId];
        for (const stationName in lineStations) {
            const stationCode = stationName.replace(/\s/g, '').toUpperCase().substring(0, 20);
            const query = `
                UPDATE metro_stations
                SET station_code = ?
                WHERE station_name = ? AND line_id = ?
            `;
            try {
                await conn.query(query, [stationCode, stationName, lineId]);
            } catch (err) {
                // ignore error
            }
        }
    }
    console.log('Station codes correction finished.');
}


async function main() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log('Connected to the database.');

        await ensureSchema(conn);
        await correctStationCodes(conn);

    } catch (err) {
        console.error(err);
    } finally {
        if (conn) conn.release();
        pool.end();
    }
}

main();
