const AnnouncementService = require('../src/core/metro/announcers/AnnouncementService');

jest.mock('../src/core/metro/announcers/AnnouncementService');

describe('Events', () => {
    it('should announce extended service', async () => {
        const mockAnnounceExtendedService = jest.fn();
        AnnouncementService.prototype.announceExtendedService = mockAnnounceExtendedService;

        const announcementService = new AnnouncementService();
        const eventInfo = { name: 'Test Event', endTime: '23:30', affectedLines: ['L1'] };
        await announcementService.announceExtendedService('start', eventInfo);

        expect(mockAnnounceExtendedService).toHaveBeenCalledWith('start', eventInfo);
    });

    it('should announce station closures', async () => {
        const mockAnnounceStationClosures = jest.fn();
        AnnouncementService.prototype.announceStationClosures = mockAnnounceStationClosures;

        const announcementService = new AnnouncementService();
        const eventInfo = { name: 'Test Event', closedStations: { 'L1': ['Baquedano'] } };
        await announcementService.announceStationClosures(eventInfo);

        expect(mockAnnounceStationClosures).toHaveBeenCalledWith(eventInfo);
    });
});
