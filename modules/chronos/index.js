// modules/chronos/index.js
const ScheduleManager = require('./ScheduleManager');

// Initialize and export a configured instance
const chronos = {
  init: (client) => {
    const manager = new ScheduleManager(client);
    manager.init();
    return manager;
  }
};

module.exports = chronos;