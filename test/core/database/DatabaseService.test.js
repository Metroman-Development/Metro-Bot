const assert = require('assert');
const sinon = require('sinon');
const DatabaseService = require('../../../src/core/database/DatabaseService');
const DatabaseManager = require('../../../src/core/database/DatabaseManager');

describe('DatabaseService', () => {
    let dbService;
    let dbManagerMock;

    beforeEach(async () => {
        dbManagerMock = sinon.createStubInstance(DatabaseManager);
        dbManagerMock.pool = {
            getConnection: sinon.stub().returns({
                beginTransaction: sinon.stub().resolves(),
                commit: sinon.stub().resolves(),
                rollback: sinon.stub().resolves(),
                release: sinon.stub().resolves(),
                query: sinon.stub().resolves(),
            }),
        };
        dbService = await DatabaseService.getInstance(dbManagerMock);
    });

    afterEach(() => {
        sinon.restore();
        DatabaseService._instance = null; // Reset singleton instance
    });

    describe('logStatusChange', () => {
        it('should create a new station_status record if it does not exist', async () => {
            const changeRecord = {
                type: 'station',
                id: 'NEWST',
                from: null,
                to: { code: 'new_status', message: 'New station message', appMessage: 'New station app message' },
                timestamp: new Date(),
            };

            const connection = dbManagerMock.pool.getConnection();
            connection.query.withArgs('SELECT status_type_id FROM js_status_mapping WHERE js_code = ?', ['new_status']).resolves([{ status_type_id: 1 }]);
            connection.query.withArgs('SELECT station_id FROM metro_stations WHERE station_code = ?', ['NEWST']).resolves([{ station_id: 123 }]);
            connection.query.withArgs('SELECT status_id FROM station_status WHERE station_id = ?', [123]).resolves([]); // No existing status
            connection.query.withArgs('INSERT INTO station_status (station_id, status_type_id, status_description, status_message, updated_by) VALUES (?, ?, ?, ?, ?)').resolves({ insertId: 456 });

            await dbService.logStatusChange(changeRecord);

            assert(connection.query.calledWith('INSERT INTO station_status (station_id, status_type_id, status_description, status_message, updated_by) VALUES (?, ?, ?, ?, ?)', [123, 1, 'New station message', 'New station app message', 'system']));
            assert(connection.query.calledWith(sinon.match.string, [456, 123, 1, 'New station message', 'New station app message', null, 0, 'none', changeRecord.timestamp, 'system']));
        });
    });
});
