/*const MetroCore = require('./MetroCore');
const logger = require('../../events/logger');

// Create core instance
const core = new MetroCore();

// Initialize function
async function initialize() {
  try {
    await core.initialize();
    setInterval(() => {
      core.updateCache().catch(error => {
        logger.error('METRO_UPDATE_FAIL', `Auto-update failed: ${error.message}`);
      });
    },60000);
    logger.info('METRO_SYSTEM_READY', 'Metro system operational');
    return true;
  } catch (error) {
    logger.error('METRO_SYSTEM_FAIL', `Critical failure: ${error.message}`);
    throw error;
  }
}

// Export both the core and initialize function
module.exports = {
  core,
  initialize, // Make sure this is exported
  lines: require('./queries/lines')(core),
  stations: require('./queries/stations')(core),
  strings: require('./utils/stringHandlers'),
  refreshData: () => core.updateCache(),
  getRawData: () => core.data,
  forceClosedState: () => core.update(core.generateClosedState())
};*/