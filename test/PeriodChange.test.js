const AnnouncementService = require('../src/core/metro/announcers/AnnouncementService');

jest.mock('../src/core/metro/announcers/AnnouncementService');

describe('PeriodChange', () => {
    it('should announce fare period change', async () => {
        const mockAnnounceFarePeriodChange = jest.fn();
        AnnouncementService.prototype.announceFarePeriodChange = mockAnnounceFarePeriodChange;

        const announcementService = new AnnouncementService();
        await announcementService.announceFarePeriodChange('PUNTA', { end: '09:00' });

        expect(mockAnnounceFarePeriodChange).toHaveBeenCalledWith('PUNTA', { end: '09:00' });
    });
});
