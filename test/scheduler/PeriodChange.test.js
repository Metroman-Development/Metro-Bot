const chronosConfig = require('../../src/config/chronosConfig');

describe('Scheduler Period Change Jobs', () => {
    it('should have jobs for service start', () => {
        const jobs = chronosConfig.jobs.filter(j => j.task === 'statusManager.handleServiceStart');
        expect(jobs.length).toBe(3);
        expect(jobs.map(j => j.name)).toEqual(expect.arrayContaining([
            'Service Start Weekday',
            'Service Start Saturday',
            'Service Start Sunday/Festive'
        ]));
    });

    it('should have jobs for service end', () => {
        const jobs = chronosConfig.jobs.filter(j => j.task === 'statusManager.handleServiceEnd');
        expect(jobs.length).toBe(3);
        expect(jobs.map(j => j.name)).toEqual(expect.arrayContaining([
            'Service End Weekday',
            'Service End Saturday',
            'Service End Sunday/Festive'
        ]));
    });

    it('should have jobs for fare period change', () => {
        const jobs = chronosConfig.jobs.filter(j => j.task === 'statusManager.handleFarePeriodChange');
        expect(jobs.length).toBe(7);
    });

    it('should have jobs for express service', () => {
        const activateJobs = chronosConfig.jobs.filter(j => j.task === 'apiService.activateExpressService');
        const deactivateJobs = chronosConfig.jobs.filter(j => j.task === 'apiService.deactivateExpressService');
        expect(activateJobs.length).toBe(2);
        expect(deactivateJobs.length).toBe(2);
    });
});
