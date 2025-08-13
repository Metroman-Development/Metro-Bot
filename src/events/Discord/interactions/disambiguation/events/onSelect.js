const { DisambiguationHandler } = require('../DisambiguationHandler');

module.exports = {
    customId: /^disambig:select:.+:\d+$/,
    async execute(interaction) {
        await DisambiguationHandler.handle(interaction);
    }
};