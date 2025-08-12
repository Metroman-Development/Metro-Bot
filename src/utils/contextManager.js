const commandContexts = new Map();

module.exports = {
    setCommandContext(commandId, data) {
        commandContexts.set(commandId, {
            ...data,
            timestamp: Date.now()
        });
    },

    getCommandContext(commandId) {
        return commandContexts.get(commandId);
    },

    cleanupOldContexts() {
        const now = Date.now();
        for (const [id, ctx] of commandContexts) {
            if (now - ctx.timestamp > 3600000) { // 1 hora
                commandContexts.delete(id);
            }
        }
    }
};
