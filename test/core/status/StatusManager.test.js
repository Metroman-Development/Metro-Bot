const StatusManager = require('../../../src/core/status/StatusManager');
const sinon = require('sinon');

describe('StatusManager', () => {
    let statusManager;
    let dbManagerMock;

    beforeEach(() => {
        dbManagerMock = {
            query: sinon.stub().resolves()
        };
        statusManager = new StatusManager(dbManagerMock);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('should activate express service for all express lines', async () => {
        await statusManager.activateExpressService();
        expect(dbManagerMock.query.callCount).toBe(3);
        expect(dbManagerMock.query.getCall(0).args[0]).toBe(`UPDATE metro_lines SET express_status = 'active' WHERE line_id = ?`);
        expect(dbManagerMock.query.getCall(0).args[1]).toEqual(['l2']);
        expect(dbManagerMock.query.getCall(1).args[0]).toBe(`UPDATE metro_lines SET express_status = 'active' WHERE line_id = ?`);
        expect(dbManagerMock.query.getCall(1).args[1]).toEqual(['l4']);
        expect(dbManagerMock.query.getCall(2).args[0]).toBe(`UPDATE metro_lines SET express_status = 'active' WHERE line_id = ?`);
        expect(dbManagerMock.query.getCall(2).args[1]).toEqual(['l5']);
    });

    it('should deactivate express service for all express lines', async () => {
        await statusManager.deactivateExpressService();
        expect(dbManagerMock.query.callCount).toBe(3);
        expect(dbManagerMock.query.getCall(0).args[0]).toBe(`UPDATE metro_lines SET express_status = 'inactive' WHERE line_id = ?`);
        expect(dbManagerMock.query.getCall(0).args[1]).toEqual(['l2']);
        expect(dbManagerMock.query.getCall(1).args[0]).toBe(`UPDATE metro_lines SET express_status = 'inactive' WHERE line_id = ?`);
        expect(dbManagerMock.query.getCall(1).args[1]).toEqual(['l4']);
        expect(dbManagerMock.query.getCall(2).args[0]).toBe(`UPDATE metro_lines SET express_status = 'inactive' WHERE line_id = ?`);
        expect(dbManagerMock.query.getCall(2).args[1]).toEqual(['l5']);
    });
});
