const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const { fetchMetroData } = require('../events/metroDataHandler');
const db = require('./db');

const SCHEMA_PATH = path.join(__dirname, 'schemas');
const API_TEMPLATE = require(path.join(SCHEMA_PATH, 'api-template.json'));
const DB_TEMPLATE = require(path.join(SCHEMA_PATH, 'db-template.json'));

const ajv = new Ajv({ allErrors: true });

async function validateBootIntegrity() {
  try {
    // Validate API structure
    const apiData = await fetchMetroData();
    const apiValid = ajv.validate(API_TEMPLATE, apiData);
    
    if (!apiValid) {
      await handleApiDiscrepancies(ajv.errors);
    }

    // Validate Database structure
    const dbValid = await validateDatabaseSchema();
    if (!dbValid) {
      await handleDbDiscrepancies();
    }

    return apiValid && dbValid;
  } catch (error) {
    console.error('Boot validation failed:', error);
    process.exit(1);
  }
}

async function handleApiDiscrepancies(errors) {
  const errorReport = {
    timestamp: new Date().toISOString(),
    receivedData: apiData,
    expectedSchema: API_TEMPLATE,
    validationErrors: errors
  };

  // Write discrepancy report
  fs.writeFileSync(
    path.join(__dirname, 'logs', 'api-discrepancy.log'),
    JSON.stringify(errorReport, null, 2)
  );

  // Write expected structure sample
  fs.writeFileSync(
    path.join(__dirname, 'data', 'expected-api-structure.json'),
    JSON.stringify(generateSampleFromTemplate(API_TEMPLATE), null, 2)
  );
}

async function validateDatabaseSchema() {
  try {
    // Get database name from the connection config (if needed)
    const dbName = 's336679_metromegabase'; // Or get this from config
    
    // MySQL-specific schema query using the existing db interface
    const [schemaResults] = await db.query(`
      SELECT 
        TABLE_NAME as table_name,
        COLUMN_NAME as column_name, 
        DATA_TYPE as data_type
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `, [dbName]);

    if (!schemaResults) {
      throw new Error('Database schema query returned no results');
    }

    return ajv.validate(DB_TEMPLATE, transformDbSchema(schemaResults));
  } catch (error) {
    console.error('Database schema validation failed:', error);
    return false;
  }
}

async function verifyDatabaseSchema() {
  try {
    const requiredTables = ['stations', 'lines', 'status_history'];
    const [rows] = await db.query(`
      SELECT TABLE_NAME as table_name 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ?
    `, [db.config.connectionConfig.database]);
    
    const existingTables = rows.map(row => row.table_name);
    return requiredTables.every(table => existingTables.includes(table));
  } catch (error) {
    logger.error(`Database verification failed: ${error.message}`);
    return false;
  }
}

function transformDbSchema(dbSchema) {
  if (!dbSchema || !Array.isArray(dbSchema)) {
    console.error('Invalid database schema input:', dbSchema);
    return {};
  }

  return dbSchema.reduce((acc, row) => {
    if (!row || !row.table_name || !row.column_name || !row.data_type) {
      console.warn('Skipping invalid row:', row);
      return acc;
    }
    
    acc[row.table_name] = acc[row.table_name] || {};
    acc[row.table_name][row.column_name] = row.data_type;
    return acc;
  }, {});
}

async function handleDbDiscrepancies() {
  // Generate migration script
  const currentSchema = await getCurrentDbSchema();
  const migrationScript = generateMigrationScript(currentSchema, DB_TEMPLATE);
  
  fs.writeFileSync(
    path.join(__dirname, 'migrations', `${Date.now()}-schema-fix.sql`),
    migrationScript
  );

  // Optional: Auto-apply migrations
  if (process.env.AUTO_MIGRATE === 'true') {
    await db.query(migrationScript);
  }
}

async function validateApiStructure() {

  try {

    const apiData = await fetchMetroData();

    return ajv.validate(API_TEMPLATE, apiData);

  } catch (error) {

    console.error('API validation failed:', error);

    return false;

  }

}

// Initialize validation
module.exports = {
    validateBootIntegrity, 
    validateDatabaseSchema 
   } ;