// This is a dummy file to prevent a crash due to a missing module.
// The bug tracking functionality is not implemented.

const reportBug = async (componente, mensajeLog, author) => {
    console.warn(`[BUG-TRACKER] reportBug called, but not implemented. Args: ${componente}, ${mensajeLog}, ${author}`);
    return 'dummy-bug-id';
};

const resolveBug = async (bugId) => {
    console.warn(`[BUG-TRACKER] resolveBug called, but not implemented. Args: ${bugId}`);
    return;
};

const getBugById = async (bugId) => {
    console.warn(`[BUG-TRACKER] getBugById called, but not implemented. Args: ${bugId}`);
    return null;
};

module.exports = {
    reportBug,
    resolveBug,
    getBugById,
};
