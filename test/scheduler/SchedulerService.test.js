const SchedulerService = require('../../src/core/chronos/SchedulerService');
const logger = require('../../src/events/logger');

// Mock the logger to prevent console output during tests
jest.mock('../../src/events/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
}));

describe('SchedulerService', () => {
    let scheduler;

    beforeEach(() => {
        scheduler = new SchedulerService();
        jest.useFakeTimers();
    });

    afterEach(() => {
        scheduler.stop();
        jest.useRealTimers();
    });

    it('should add a job to the jobs list', () => {
        const job = { name: 'test-job', interval: 1000, task: () => {} };
        scheduler.addJob(job);
        expect(scheduler.jobs).toHaveLength(1);
        expect(scheduler.jobs[0]).toEqual(job);
    });

    it('should throw an error if a job is missing required properties', () => {
        const invalidJob = { name: 'invalid-job', interval: 1000 }; // Missing task
        expect(() => scheduler.addJob(invalidJob)).toThrow('Job must have a name, interval, and task');
    });

    it('should start running jobs when start is called', () => {
        const task = jest.fn();
        const job = { name: 'test-job', interval: 1000, task };
        scheduler.addJob(job);
        scheduler.start();

        // Fast-forward time by 1 second
        jest.advanceTimersByTime(1000);
        expect(task).toHaveBeenCalledTimes(1);

        // Fast-forward time by another second
        jest.advanceTimersByTime(1000);
        expect(task).toHaveBeenCalledTimes(2);
    });

    it('should stop all running jobs when stop is called', () => {
        const task = jest.fn();
        const job = { name: 'test-job', interval: 1000, task };
        scheduler.addJob(job);
        scheduler.start();

        // Fast-forward time by 1 second
        jest.advanceTimersByTime(1000);
        expect(task).toHaveBeenCalledTimes(1);

        scheduler.stop();

        // Fast-forward time by another second
        jest.advanceTimersByTime(1000);
        expect(task).toHaveBeenCalledTimes(1); // Should not have been called again
    });

    it('should handle errors in tasks without stopping the scheduler', () => {
        const failingTask = jest.fn(() => {
            throw new Error('Task failed');
        });
        const job = { name: 'failing-job', interval: 1000, task: failingTask };
        scheduler.addJob(job);
        scheduler.start();

        // Fast-forward time by 1 second
        jest.advanceTimersByTime(1000);
        expect(failingTask).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error in job failing-job'), expect.any(Error));

        // Fast-forward time by another second to ensure the scheduler is still running
        jest.advanceTimersByTime(1000);
        expect(failingTask).toHaveBeenCalledTimes(2);
    });
});
