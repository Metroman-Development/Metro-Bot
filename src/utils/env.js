function getDbHost() {
    return process.env.DB_HOST || 'localhost';
}

module.exports = {
    getDbHost,
};
