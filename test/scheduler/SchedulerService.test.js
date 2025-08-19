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

    it('should add a job to the jobs map', () => {
        const job = { name: 'test-job', interval: 1000, task: () => {} };
        scheduler.addJob(job);
        expect(scheduler.getJob('test-job')).toBeDefined();
    });

    it('should throw an error if a job is missing required properties', () => {
        const invalidJob = { name: 'invalid-job', interval: 1000 }; // Missing task
        expect(() => scheduler.addJob(invalidJob)).toThrow('Job must have a name, interval, and task');
    });

    it('should start running jobs when start is called', async () => {
        const task = jest.fn();
        const job = { name: 'test-job', interval: 1000, task };
        scheduler.addJob(job);
        scheduler.start();

        // The job should start immediately
        expect(task).toHaveBeenCalledTimes(1);

        // Fast-forward time by 1 second
        await jest.advanceTimersByTimeAsync(1000);
        expect(task).toHaveBeenCalledTimes(2);
    });

    it('should stop all running jobs when stop is called', async () => {
        const task = jest.fn();
        const job = { name: 'test-job', interval: 1000, task };
        scheduler.addJob(job);
        scheduler.start();

        // The job should start immediately
        expect(task).toHaveBeenCalledTimes(1);

        scheduler.stop();

        // Fast-forward time by another second
        await jest.advanceTimersByTimeAsync(1000);
        expect(task).toHaveBeenCalledTimes(1); // Should not have been called again
    });

    it('should handle errors in tasks without stopping the scheduler', async () => {
        const failingTask = jest.fn(async () => {
            throw new Error('Task failed');
        });
        const job = { name: 'failing-job', interval: 1000, task: failingTask };
        scheduler.addJob(job);
        scheduler.start();

        // The job should start immediately
        expect(failingTask).toHaveBeenCalledTimes(1);

        // Wait for the task to finish
        await Promise.resolve();

        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error in job failing-job'), expect.any(Error));

        // Fast-forward time by another second to ensure the scheduler is still running
        await jest.advanceTimersByTimeAsync(1000);
        expect(failingTask).toHaveBeenCalledTimes(2);
    });

    it('should not run a job if it is already running', async () => {
        const longRunningTask = jest.fn(async () => {
            // Simulate a long-running task
            await new Promise(resolve => setTimeout(resolve, 2000));
        });
        const job = { name: 'long-running-job', interval: 1000, task: longRunningTask };
        scheduler.addJob(job);
        scheduler.start();

        // The job should start immediately
        expect(longRunningTask).toHaveBeenCalledTimes(1);

        // Fast-forward time by 1 second. The job should still be running.
        jest.advanceTimersByTime(1000);

        // The job should not have been called again because it's still running
        expect(longRunningTask).toHaveBeenCalledTimes(1);

        // Let the original task finish
        await jest.advanceTimersByTimeAsync(1000);

        // Now that the first task has finished, the next one should be scheduled and run
        jest.advanceTimersByTime(1000);
        expect(longRunningTask).toHaveBeenCalledTimes(2);
    });
});
