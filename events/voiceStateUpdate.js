const bipCoinSystem = require('./bipCoinSystem');

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState, client) {
        const userId = newState.member.id;
        const username = newState.member.user.username;

        // Verificar si el usuario se unió a un canal de voz
        if (newState.channelId && !oldState.channelId) {
            await bipCoinSystem.addBipCoinsForVoice(userId, username, client);
        }
    },
};