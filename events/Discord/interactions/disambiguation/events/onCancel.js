const { DisambiguationHandler } = require('../DisambiguationHandler');

module.exports = {
    customId: /^disambig:cancel:.+$/,
    async execute(interaction) {
        await DisambiguationHandler.handle(interaction);
    }
};