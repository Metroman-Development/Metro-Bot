const StatusManager = require('../../../src/core/status/StatusManager');
const sinon = require('sinon');
const { MetroInfoProvider } = require('../../../src/utils/MetroInfoProvider');

describe('StatusManager', () => {
    let statusManager;
    let dbManagerMock;
    let dataManagerMock;
    let announcementServiceMock;
    let statusEmbedManagerMock;
    let metroInfoProviderMock;

    beforeEach(() => {
        dbManagerMock = {
            query: sinon.stub().resolves([])
        };
        dataManagerMock = {
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

        statusManager = new StatusManager(dbManagerMock, dataManagerMock, announcementServiceMock, statusEmbedManagerMock);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('should call updateAllEmbeds on handleServiceStart', async () => {
        await statusManager.handleServiceStart({});
        sinon.assert.calledWith(dataManagerMock.setServiceStatus, 'open');
        sinon.assert.calledWith(announcementServiceMock.announceServiceTransition, 'start', {});
        sinon.assert.calledOnce(statusEmbedManagerMock.updateAllEmbeds);
    });

    it('should call updateAllEmbeds on handleServiceEnd', async () => {
        await statusManager.handleServiceEnd({});
        sinon.assert.calledWith(dataManagerMock.setServiceStatus, 'closed');
        sinon.assert.calledWith(announcementServiceMock.announceServiceTransition, 'end', {});
        sinon.assert.calledOnce(statusEmbedManagerMock.updateAllEmbeds);
    });

    it('should skip closing stations if an extension is active', async () => {
        // Arrange
        const fakeExtension = [{ id: 1, event_name: 'Test Extension' }];
        dbManagerMock.query.resolves(fakeExtension);

        // Act
        await statusManager.handleServiceEnd({});

        // Assert
        sinon.assert.notCalled(dataManagerMock.setServiceStatus);
        sinon.assert.calledWith(announcementServiceMock.announceServiceTransition, 'end', {}, 'with extensions');
    });

    it('should call updateAllEmbeds on handleFarePeriodChange', async () => {
        await statusManager.handleFarePeriodChange({ type: 'punta' });
        sinon.assert.calledWith(announcementServiceMock.announceFarePeriodChange, 'punta', { type: 'punta' });
        sinon.assert.calledOnce(statusEmbedManagerMock.updateAllEmbeds);
    });
});
