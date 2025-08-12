const pool = require('./database');

/**

 * Check if the bugs table exists, and create it if it doesn't.

 * @returns {Promise<void>}

 */

async function createBugsTableIfNotExists() {

    let connection;

    try {

        // Get a connection from the pool

        connection = await pool.getConnection();

        // Check if the table exists

        const [rows] = await connection.query(`

            SELECT COUNT(*) as count

            FROM information_schema.tables

            WHERE table_schema = DATABASE()

            AND table_name = 'bugs'

        `);

        // If the table does not exist, create it

        if (rows[0].count === 0) {

            await connection.query(`

                CREATE TABLE bugs (

                    id INT AUTO_INCREMENT PRIMARY KEY,

                    bug_id VARCHAR(50) NOT NULL UNIQUE,

                    title VARCHAR(255) NOT NULL,

                    description TEXT NOT NULL,

                    reported_by VARCHAR(255) NOT NULL,

                    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                    resolved BOOLEAN DEFAULT FALSE,

                    resolved_at TIMESTAMP NULL

                )

            `);

            console.log('Bugs table created successfully!');

        } else {

            console.log('Bugs table already exists.');

        }

    } catch (error) {

        console.error('Error creating bugs table:', error);

    } finally {

        // Release the connection back to the pool

        if (connection) connection.release();

    }

}

/**

 * Generate a descriptive bug ID.

 * @param {string} component - The component related to the bug.

 * @returns {Promise<string>} - The generated bug ID (e.g., BUG-PLAY-001).

 */

async function generateBugId(component) {

    // Normalize the component name (e.g., "!play" -> "PLAY")

    const normalizedComponent = component.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    // Start a transaction

    const connection = await pool.getConnection();

    await connection.beginTransaction();

    try {

        // Find the highest sequential number for this component

        const [rows] = await connection.query(

            'SELECT bug_id FROM bugs WHERE bug_id LIKE ? ORDER BY bug_id DESC LIMIT 1 FOR UPDATE',

            [`BUG-${normalizedComponent}-%`]

        );

        let sequentialNumber = 1;

        if (rows.length > 0) {

            const lastBugId = rows[0].bug_id;

            sequentialNumber = parseInt(lastBugId.split('-')[2], 10) + 1;

        }

        // Generate the bug ID (e.g., BUG-PLAY-001)

        const bugId = `BUG-${normalizedComponent}-${sequentialNumber.toString().padStart(3, '0')}`;

        // Commit the transaction

        await connection.commit();

        return bugId;

    } catch (error) {

        // Rollback the transaction in case of an error

        await connection.rollback();

        throw error;

    } finally {

        // Release the connection

        connection.release();

    }

}

/**

 * Report a new bug.

 * @param {string} title - The title of the bug.

 * @param {string} description - The description of the bug.

 * @param {string} reportedBy - The user who reported the bug.

 * @returns {Promise<string>} - The generated bug ID.

 */

async function reportBug(title, description, reportedBy) {

    const bugId = await generateBugId(title); // Use the title or component to generate the bug ID

    await pool.query(

        'INSERT INTO bugs (bug_id, title, description, reported_by) VALUES (?, ?, ?, ?)',

        [bugId, title, description, reportedBy]

    );

    return bugId;

}

/**

 * Mark a bug as resolved.

 * @param {string} bugId - The descriptive bug ID (e.g., BUG-PLAY-001).

 * @returns {Promise<void>}

 */

async function resolveBug(bugId) {

    await pool.query(

        'UPDATE bugs SET resolved = TRUE, resolved_at = CURRENT_TIMESTAMP WHERE bug_id = ?',

        [bugId]

    );

}

/**

 * Get all unresolved bugs.

 * @returns {Promise<Array>} - A list of unresolved bugs.

 */

async function getUnresolvedBugs() {

    const [rows] = await pool.query('SELECT * FROM bugs WHERE resolved = FALSE ORDER BY reported_at DESC');

    return rows;

}

/**

 * Get all bugs.

 * @returns {Promise<Array>} - A list of all bugs.

 */

async function getAllBugs() {

    const [rows] = await pool.query('SELECT * FROM bugs ORDER BY reported_at DESC');

    return rows;

}

/**

 * Get a bug by its ID.

 * @param {string} bugId - The bug ID (e.g., BUG-PLAY-001).

 * @returns {Promise<Object>} - The bug details.

 */

async function getBugById(bugId) {

    const [rows] = await pool.query('SELECT * FROM bugs WHERE bug_id = ?', [bugId]);

    return rows[0];

}

// Ensure the bugs table exists when the module is loaded

createBugsTableIfNotExists().catch(err => {

    console.error('Failed to create bugs table:', err);

});

module.exports = {

    reportBug,

    resolveBug,

    getUnresolvedBugs,

    getAllBugs,

    getBugById

};
