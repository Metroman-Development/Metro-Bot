const EventEmitter = require('events');
const logger = require('../../../events/logger.js');

class UpdateCoordinator extends EventEmitter {
    constructor(changeDetector, statusUpdater) {
        super();
        if (!changeDetector || !statusUpdater) {
            throw new Error('UpdateCoordinator requires both ChangeDetector and StatusUpdater');
        }

        this.changeDetector = changeDetector;
        this.statusUpdater = statusUpdater;
        this.isUpdating = false;
        this.updateQueue = [];
        this.consecutiveErrors = 0;
        this.MAX_CONSECUTIVE_ERRORS = 5;

        this.setupEventForwarding();
        this.setupDefaultListeners();
    }

    setupEventForwarding() {
        // Forward change events to updater
        this.changeDetector.on('changesDetected', (changes) => {
            if (changes.hasChanges) {
                logger.debug('COORDINATOR_PROCESSING_CHANGES');
                this.queueUpdate(changes);
            }
        });

        // Forward significant changes with higher priority
        this.changeDetector.on('significantChanges', (changes) => {
            logger.info('COORDINATOR_PRIORITY_UPDATE');
            this.queueUpdate(changes, true);
        });

        // Error handling
        this.changeDetector.on('error', (error) => {
            this.handleError(error);
        });

        // Status updater events
        this.statusUpdater.on('updateComplete', (result) => {
            this.handleUpdateComplete(result);
        });

        this.statusUpdater.on('updateFailed', (error) => {
            this.handleError(error);
        });
    }

    setupDefaultListeners() {
        this.on('error', (error) => {
            logger.error('UPDATE_COORDINATOR_ERROR', {
                error: error.message,
                stack: error.stack,
                consecutiveErrors: this.consecutiveErrors
            });
        });

        this.on('updateQueued', (item) => {
            logger.debug('UPDATE_QUEUED', {
                priority: item.priority,
                queueSize: this.updateQueue.length
            });
        });

        this.on('updateStarted', () => {
            logger.info('UPDATE_STARTED');
        });

        this.on('updateComplete', (result) => {
            logger.info('UPDATE_CYCLE_COMPLETE', {
                success: result.success,
                changesDetected: result.changesDetected
            });
        });
    }

    queueUpdate(changes, priority = false) {
        const updateItem = {
            changes,
            priority,
            timestamp: new Date()
        };

        if (priority) {
            this.updateQueue.unshift(updateItem);
        } else {
            this.updateQueue.push(updateItem);
        }

        this.emit('updateQueued', updateItem);
        this.processQueue();
    }

    async processQueue() {
        if (this.isUpdating || this.updateQueue.length === 0) return;

        this.isUpdating = true;
        const nextUpdate = this.updateQueue.shift();

        try {
            this.emit('updateStarted');
            await this.statusUpdater.handleDataUpdate(nextUpdate.changes);
        } catch (error) {
            this.handleError(error);
        } finally {
            this.isUpdating = false;
            if (this.updateQueue.length > 0) {
                setImmediate(() => this.processQueue());
            }
        }
    }

    async handleUpdateComplete(result) {
        this.consecutiveErrors = 0;
        this.emit('updateComplete', {
            success: true,
            changesDetected: result.hasChanges,
            timestamp: new Date().toISOString()
        });
    }

    handleError(error) {
        this.consecutiveErrors++;
        if (this.consecutiveErrors >= this.MAX_CONSECUTIVE_ERRORS) {
            this.emit('fatalError', new Error(`Maximum consecutive errors (${this.MAX_CONSECUTIVE_ERRORS}) reached`));
            return;
        }

        this.emit('error', error);
    }

    async startUpdateCycle() {
        try {
            this.emit('updateCycleStarting');
            const changes = await this.changeDetector.analyzeChanges();
            return {
                success: true,
                changesDetected: changes.hasChanges,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    getQueueStatus() {
        return {
            size: this.updateQueue.length,
            nextUpdate: this.updateQueue[0]?.timestamp,
            isUpdating: this.isUpdating
        };
    }
}

module.exports = UpdateCoordinator;