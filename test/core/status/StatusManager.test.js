const StatusManager = require('../../../src/core/status/StatusManager');
const sinon = require('sinon');
const MetroInfoProvider = require('../../../src/utils/MetroInfoProvider');

describe('StatusManager', () => {
    let statusManager;
    let dbManagerMock;
    let apiServiceMock;
    let announcementServiceMock;
    let statusEmbedManagerMock;
    let metroInfoProviderMock;

    beforeEach(() => {
        dbManagerMock = {
            query: sinon.stub().resolves()
        };
        apiServiceMock = {
            setServiceStatus: sinon.stub().resolves()
        };
        announcementServiceMock = {
            announceServiceTransition: sinon.stub().resolves(),
            announceFarePeriodChange: sinon.stub().resolves()
        };
        statusEmbedManagerMock = {
            updateAllEmbeds: sinon.stub().resolves()
        };
        const metroInfoProviderInstance = {
            getFullData: sinon.stub().returns({ some: 'data' })
        };
        metroInfoProviderMock = sinon.stub(MetroInfoProvider, 'getInstance').returns(metroInfoProviderInstance);

        statusManager = new StatusManager(dbManagerMock, apiServiceMock, announcementServiceMock, statusEmbedManagerMock);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('should call updateAllEmbeds on handleServiceStart', async () => {
        await statusManager.handleServiceStart({});
        sinon.assert.calledWith(apiServiceMock.setServiceStatus, 'open');
        sinon.assert.calledWith(announcementServiceMock.announceServiceTransition, 'start', {});
        sinon.assert.calledOnce(statusEmbedManagerMock.updateAllEmbeds);
    });

    it('should call updateAllEmbeds on handleServiceEnd', async () => {
        await statusManager.handleServiceEnd({});
        sinon.assert.calledWith(apiServiceMock.setServiceStatus, 'closed');
        sinon.assert.calledWith(announcementServiceMock.announceServiceTransition, 'end', {});
        sinon.assert.calledOnce(statusEmbedManagerMock.updateAllEmbeds);
    });

    it('should call updateAllEmbeds on handleFarePeriodChange', async () => {
        await statusManager.handleFarePeriodChange({ type: 'punta' });
        sinon.assert.calledWith(announcementServiceMock.announceFarePeriodChange, 'punta', { type: 'punta' });
        sinon.assert.calledOnce(statusEmbedManagerMock.updateAllEmbeds);
    });

    it('should activate express service for all express lines', async () => {
        await statusManager.activateExpressService();
        sinon.assert.callCount(dbManagerMock.query, 3);
        sinon.assert.calledWith(dbManagerMock.query.getCall(0), `UPDATE metro_lines SET express_status = 'active' WHERE line_id = ?`, ['l2']);
        sinon.assert.calledWith(dbManagerMock.query.getCall(1), `UPDATE metro_lines SET express_status = 'active' WHERE line_id = ?`, ['l4']);
        sinon.assert.calledWith(dbManagerMock.query.getCall(2), `UPDATE metro_lines SET express_status = 'active' WHERE line_id = ?`, ['l5']);
    });

    it('should deactivate express service for all express lines', async () => {
        await statusManager.deactivateExpressService();
        sinon.assert.callCount(dbManagerMock.query, 3);
        sinon.assert.calledWith(dbManagerMock.query.getCall(0), `UPDATE metro_lines SET express_status = 'inactive' WHERE line_id = ?`, ['l2']);
        sinon.assert.calledWith(dbManagerMock.query.getCall(1), `UPDATE metro_lines SET express_status = 'inactive' WHERE line_id = ?`, ['l4']);
        sinon.assert.calledWith(dbManagerMock.query.getCall(2), `UPDATE metro_lines SET express_status = 'inactive' WHERE line_id = ?`, ['l5']);
    });
});
