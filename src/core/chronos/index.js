// modules/chronos/index.js
const ScheduleManager = require('managers/ScheduleManager.js');

// Initialize and export a configured instance
const chronos = {
  init: (client) => {
    const manager = new ScheduleManager(client);
    manager.init();
    return manager;
  }
};

module.exports = chronos;