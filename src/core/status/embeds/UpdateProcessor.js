const logger = require('../../../events/logger');
const EventRegistry = require('../../../core/EventRegistry');
const EventPayload = require('../../../core/EventPayload');
const { performance } = require('perf_hooks');
const timeUtils = require('../../../utils/timeHelpers');
const TelegramBot = require('../../../bot/discord/commands/slash/Bot_Info/bot.js');
const ChangeAnnouncer = require('../ChangeAnnouncer');
const SystemStatusEmbed = require('../../../templates/embeds/SystemStatusEmbed.js');

class UpdateProcessor {
    constructor(statusUpdater) {
        if (!statusUpdater) throw new Error('StatusUpdater instance required');
        
        this.parent = statusUpdater;
        this.pendingUpdates = new Map();
        this.updateTimeout = null;
        this.currentBatchId = null;
        this.consecutiveErrors = 0;
        this.changeHistory = [];
        this.lastSuccessfulUpdate = null;

        // Configuration
        this.MAX_RETRIES = 3;
        this.BATCH_TIMEOUT_MS = 1000;
        this.DEBUG_MODE = process.env.NODE_ENV === 'development';
        this.MIN_UPDATE_INTERVAL = 500; // ms between updates

        // Priority system (TimeAwaiter gets CRITICAL)
        this.PRIORITY_LEVELS = {
            CRITICAL: 4,    // TimeAwaiter events
            HIGH: 3,        // Real-time service changes
            NORMAL: 2,      // Regular data updates
            LOW: 1,         // Background refreshes
            DEFERRABLE: 0   // Non-critical tasks
        };

        // Update type registry
        this.UPDATE_TYPES = {
            EMBED_REFRESH: 'embed_refresh',
            SERVICE_TIME: 'service_time',
            EXPRESS_TIME: 'express_time',
            FARE_PERIOD: 'fare_period',
            DATA_UPDATE: 'data_update',
            INITIAL_STATE: 'initial_state',
            CHANGES: 'changes',
            EVENT: 'event',
            STATUS_REPORT: 'status_report'
        };
    }

    // =====================
    // PUBLIC API METHODS
    // =====================

    async handleDataUpdate(data) {
        const updateId = this._generateUpdateId(this.UPDATE_TYPES.DATA_UPDATE);
        logger.debug(`[UpdateProcessor] Handling data update`, {
            updateId,
            dataVersion: data?.version
        });

        if (!this._checkEmbedsReady(updateId, this.UPDATE_TYPES.DATA_UPDATE, data)) {
            return;
        }

        try {
            await this._processDataUpdate(updateId, data);
        } catch (error) {
            this._handleUpdateError(updateId, error, this.UPDATE_TYPES.DATA_UPDATE);
        }
    }

    async handleInitialState(data) {
        const updateId = this._generateUpdateId(this.UPDATE_TYPES.INITIAL_STATE);
        logger.system(`[UpdateProcessor] Handling initial state`, {
            updateId,
            dataVersion: data?.version
        });

        try {
            await this._processInitialState(updateId, data);
        } catch (error) {
            this._handleUpdateError(updateId, error, this.UPDATE_TYPES.INITIAL_STATE);
        }
    }

    async processChanges(changePayload) {
        try {
            const { changes, newState } = changePayload;
            logger.debug('[UpdateProcessor] Processing changes', {
                changeCount: changes.length
            });

            const messages = await this._prepareChangeMessages(changes, newState);
            await this.parent.announcer.processChangeMessages(messages, changes.severity);

            await this._updateEmbedsForChanges(newState, changes);

            this._logChangeHistory(changes);
            this.parent.emit('changesProcessed', changes);
        } catch (error) {
            this._handleProcessingError(error, 'changes');
        }
    }

    async processPendingUpdates() {
        if (!this._canProcessUpdates()) return;

        const batchId = `batch-${Date.now()}`;
        this.currentBatchId = batchId;

        try {
            this._emitBatchStart(batchId);
            const sortedUpdates = this._sortUpdatesByPriority();

            for (const [updateId, update] of sortedUpdates) {
                if (!this._shouldProcessUpdate(update)) continue;
                
                await this._processSingleUpdate(updateId, update);
                this._enforceUpdateInterval();
            }
        } catch (error) {
            this._handleBatchError(batchId, error);
        } finally {
            this._emitBatchComplete(batchId);
        }
    }

    async forceUpdate(options = {}) {
        const updateId = `force-${Date.now()}`;
        logger.debug('[UpdateProcessor] Starting forced update', { updateId, ...options });

        try {
            this.parent.emit('forceUpdateStarted', updateId);
            const data = await this.parent.metroCore.updateCache();

            if (options.line === 'all') {
                await this.parent.embeds.updateAllEmbeds(data);
            } else {
                await this.parent.embeds.updateLineEmbed({
                    ...data.lines[options.line],
                    _allStations: data.stations
                });
            }

            this.parent.emit('forceUpdateCompleted', updateId);
        } catch (error) {
            this.parent.emit('forceUpdateFailed', { updateId, error });
            throw error;
        }
    }

    pause() {
        logger.warn('[UpdateProcessor] Pausing update processing');
        if (this.updateTimeout) clearTimeout(this.updateTimeout);
    }

    resume() {
        logger.info('[UpdateProcessor] Resuming update processing');
        this._scheduleBatchProcessing();
    }

    findPendingUpdateOfType(type) {
        return Array.from(this.pendingUpdates.values())
            .find(update => update.type === type);
    }

    logPendingUpdates() {
        if (this.pendingUpdates.size === 0) {
            logger.debug('[UpdateProcessor] No pending updates');
            return;
        }

        const report = {
            total: this.pendingUpdates.size,
            byPriority: {},
            byType: {},
            oldest: null,
            newest: null
        };

        const now = Date.now();
        this.pendingUpdates.forEach((update, id) => {
            // Update type statistics
            report.byType[update.type] = (report.byType[update.type] || 0) + 1;
            
            // Priority statistics
            const priorityLevel = update.priority || 0;
            report.byPriority[priorityLevel] = (report.byPriority[priorityLevel] || 0) + 1;
            
            // Age tracking
            const age = now - (update.timestamp || now);
            if (!report.oldest || age > report.oldest.age) {
                report.oldest = { id, age, type: update.type };
            }
            if (!report.newest || age < report.newest.age) {
                report.newest = { id, age, type: update.type };
            }
        });

        logger.debug('[UpdateProcessor] Pending updates report', report);
    }

    async handleEmbedRefresh(options = {}) {
        const updateId = this._generateUpdateId(this.UPDATE_TYPES.EMBED_REFRESH);
        this._queueUpdate(updateId, {
            type: this.UPDATE_TYPES.EMBED_REFRESH,
            data: { 
                refreshOptions: {
                    force: true, // Always force for TimeAwaiter
                    priority: 'critical',
                    ...options
                }
            },
            timestamp: new Date(),
            priority: this.PRIORITY_LEVELS.CRITICAL,
            isTimeCritical: true
        });
    }

    // =====================
    // CORE PROCESSING METHODS
    // =====================

    async _processSingleUpdate(updateId, update) {
        const startTime = performance.now();
        let result;

        try {
            this._logUpdateStart(updateId, update);

            switch(update.type) {
                case this.UPDATE_TYPES.DATA_UPDATE:
                    result = await this._processDataUpdate(updateId, update.data);
                    break;
                case this.UPDATE_TYPES.INITIAL_STATE:
                    result = await this._processInitialState(updateId, update.data);
                    break;
                case this.UPDATE_TYPES.CHANGES:
                    result = await this.processChanges(update.data.changes, update.data.allStations);
                    break;
                case this.UPDATE_TYPES.SERVICE_TIME:
                    result = await this._processServiceTimeUpdate(update.data);
                    break;
                case this.UPDATE_TYPES.EXPRESS_TIME:
                    result = await this._processExpressTimeUpdate(update.data);
                    break;
                case this.UPDATE_TYPES.FARE_PERIOD:
                    result = await this._processFarePeriodUpdate(update.data);
                    break;
                case this.UPDATE_TYPES.EVENT:
                    result = await this._processEventUpdate(update.data);
                    break;
                case this.UPDATE_TYPES.EMBED_REFRESH:
                    result = await this._processEmbedRefresh(updateId, update.data);
                    break;
                case this.UPDATE_TYPES.STATUS_REPORT:
                    result = await this._processStatusReportUpdate(updateId, update.data);
                    break;
                default:
                    logger.warn('[UpdateProcessor] Unknown update type', { type: update.type });
                    return;
            }

            this._finalizeSuccessfulUpdate(updateId, update, startTime);
        } catch (error) {
            this._handleUpdateError(updateId, update, error, startTime);
        }
    }

    async _processStatusReportUpdate(updateId, data) {
        logger.debug(`[UpdateProcessor] Processing status report update ${updateId}`);
        this.parent.emit('updateStarted', updateId);

        try {
            if (this.parent.client && this.parent.client.isReady()) {
                const systemStatusEmbed = new SystemStatusEmbed(this.parent.metroCore);
                const embed = systemStatusEmbed.createSystemStatusEmbed(data);

                const channelId = this.parent.metroCore.config.discord.channels.status_reports;
                const channel = await this.parent.client.channels.fetch(channelId);

                if (channel) {
                    await channel.send({ embeds: [embed.embed] });
                    logger.info(`[UpdateProcessor] System status report sent to channel ${channelId}`);
                } else {
                    logger.error(`[UpdateProcessor] Could not find status report channel with ID ${channelId}`);
                }
            } else {
                logger.info('[UpdateProcessor] Discord client not available. Logging status report to console instead.');
                console.log(JSON.stringify(data, null, 2));
            }
        } catch (error) {
            logger.error(`[UpdateProcessor] Error sending status report: ${error.message}`);
            logger.info('[UpdateProcessor] Logging status report to console due to error.');
            console.log(JSON.stringify(data, null, 2));
            this._handleUpdateError(updateId, error, 'status_report');
        }

        this.parent.emit('updateCompleted', updateId);
    }

    async _processDataUpdate(updateId, data) {
        logger.debug(`[UpdateProcessor] Processing data update ${updateId}`);
        this.parent.emit('updateStarted', updateId);
        
        const changes = this.parent.changeDetector.getLatest();
        if (!changes?.changes?.length) {
            logger.debug('[UpdateProcessor] No changes detected');
            this.parent.emit('updateSkipped', { updateId });
            return;
        }

        await this._processChanges(changes, data);
        this.parent.emit('updateCompleted', updateId);
    }

    async _processInitialState(updateId, data) {
        logger.debug(`[UpdateProcessor] Processing initial state ${updateId}`);
        this.parent.emit('updateStarted', updateId);

        await this.parent.embeds.updateAllEmbeds(data);
        const changes = this.parent.changeDetector.getRecentChanges();
        
        if (changes?.length) {
            await this._processInitialChanges(data, changes);
        }

        this.parent.emit('updateCompleted', updateId);
    }

    async _processInitialChanges(data, changes) {
        const messages = await this._prepareChangeMessages({ changes }, data);
        await this.parent.announcer.processChangeMessages(messages);
        
        console.log(changes)

        const changedLines = this._getAffectedLines(changes);
        
        console.log(changedLines) 
        
        await Promise.all(
            Array.from(changedLines).map(lineId => 
                this.parent.embeds.updateLineEmbed({
                    ...data.lines[lineId],
                    _allStations: data.stations
                })
            )
        );
    }

    async _processServiceTimeUpdate({ type, opening, closing, isExtended }) {
        const currentData = this.parent.metroCore.getCurrentData();
        const isStarting = type === 'start';

        await Promise.all([
            this.parent.embeds.updateOverviewEmbed(currentData),
            
             this.parent.embeds.updateOverviewEmbed(currentData).updateAllLineEmbeds, 
            this.parent.announcer.processChangeMessages([{
                type: 'service_transition',
                data: {
                    transition: isStarting ? 'starting' : 'ending',
                    hours: `${opening} - ${closing}`,
                    isExtended
                },
                severity: 'high'
            }])
        ]);

        this._emitEvent(EventRegistry.SERVICE_MODE_CHANGED, {
            active: isStarting,
            timestamp: new Date()
        });
    }

    async _processExpressTimeUpdate({ period, active, context }) {
        const currentData = this.parent.metroCore.getCurrentData();
        
        const affectedLines = 
        
        context.affectedLines ? context.affectedLines : ["l1", "l2", "l3", "l4", "l4a", "l5", "l6"];

        await Promise.all([
            this.parent.embeds.updateOverviewEmbed(currentData),
            affectedLines?.map(lineId => 
                this.parent.embeds.updateLineEmbed({
                    ...currentData.lines[lineId],
                    _allStations: currentData.stations
                })
            ),
            this.parent.announcer.processChangeMessages([{
                type: 'express_transition',
                data: {
                    period,
                    active,
                    lines: context.affectedLines
                },
                severity: 'high'
            }])
        ]);

        this._emitEvent(EventRegistry.EXPRESS_MODE_CHANGED, {
            period,
            active,
            lines: context.affectedLines
        });
    }

    async _processFarePeriodUpdate({ periodType, name, start, end }) {
        const currentData = this.parent.metroCore.getCurrentData();

        await Promise.all([
            this.parent.embeds.updateOverviewEmbed(currentData),
            
            this.parent.embeds.updateAllLineEmbeds(currentData),
            this.parent.announcer.processChangeMessages([{
                type: 'fare_period',
                data: {
                    period: periodType,
                    name,
                    effective: `${start} - ${end}`
                },
                severity: 'medium'
            }])
        ]);

        this._emitEvent(EventRegistry.FARE_PERIOD_CHANGED, {
            period: periodType,
            timestamp: new Date()
        });
    }

    async _processEventUpdate(eventData) {
        logger.debug('[UpdateProcessor] Processing event update', {
            eventType: eventData.type
        });

        const currentData = this.parent.metroCore.getCurrentData();
        
        await this.parent.embeds.updateOverviewEmbed(currentData);

        await this.parent.announcer.processChangeMessages([{
            type: 'event',
            data: eventData,
            severity: eventData.impact?.level || 'medium'
        }]);

        if (eventData.impact?.lines?.length) {
            await Promise.all(
                eventData.impact.lines.map(lineId => 
                    this.parent.embeds.updateLineEmbed({
                        ...currentData.lines[lineId],
                        _allStations: currentData.stations
                    })
                )
            );
        }
    }

    async _processEmbedRefresh(updateId, { refreshOptions = {} }) {
        this._emitEvent(EventRegistry.EMBED_REFRESH_STARTED, {
            updateId,
            ...refreshOptions
        });

        try {
            await this.parent.embeds.updateAllEmbeds(
                null, // Force fresh data
                null, // No changes object
                {
                    force: true,
                    bypassQueue: true,
                    reason: 'time_awaiter'
                }
            );

            this._emitEvent(EventRegistry.EMBED_REFRESH_COMPLETED, {
                updateId,
                status: 'success'
            });

            return { success: true };
        } catch (error) {
            this._emitEvent(EventRegistry.EMBED_REFRESH_FAILED, {
                updateId,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    // =====================
    // UTILITY METHODS
    // =====================
    
    async _prepareChangeMessages(changes, allStations) {
        if (!allStations) {
            allStations = this.parent.metroCore.getCurrentData();
            logger.warn('[UpdateProcessor] Using fallback station data');
        }
        
        const changeAnnouncer = new ChangeAnnouncer();
      
        const rawMessages = await this.parent.announcer.generateMessages(changes, allStations);
        const telMessages = await changeAnnouncer.generateTelegramMessages(changes, allStations);
        console.log(telMessages)
        await TelegramBot.sendCompactAnnouncement(telMessages);
        
        return rawMessages.map(msg => ({
            ...(typeof msg === 'string' ? { message: msg } : msg),
            severity: changes.severity || 'medium'
        }));
    }

    async _updateEmbedsForChanges(data, changes) {
        const changedLines = this._getAffectedLines(changes);
        
        await this.parent.embeds.updateOverviewEmbed(data, changes);
        await Promise.all(
            Array.from(changedLines).map(lineId => 
                this.parent.embeds.updateLineEmbed({
                    ...data.lines[lineId],
                    _allStations: data.stations
                })
            )
        );
    }

    _queueUpdate(id, update) {
        if (!id || !update) throw new Error('Invalid update parameters');
        
        update.timestamp = update.timestamp || new Date();
        update.retryCount = update.retryCount || 0;
        update.priority = update.priority || this._getDefaultPriority(update.type);
        
        this.pendingUpdates.set(id, update);
        this._scheduleBatchProcessing();
        
        logger.debug(`Queued update ${id}`, {
            type: update.type,
            priority: update.priority
        });
    }

    _getDefaultPriority(type) {
        return {
            [this.UPDATE_TYPES.EMBED_REFRESH]: this.PRIORITY_LEVELS.CRITICAL,
            [this.UPDATE_TYPES.SERVICE_TIME]: this.PRIORITY_LEVELS.HIGH,
            [this.UPDATE_TYPES.EXPRESS_TIME]: this.PRIORITY_LEVELS.HIGH,
            [this.UPDATE_TYPES.FARE_PERIOD]: this.PRIORITY_LEVELS.HIGH,
            [this.UPDATE_TYPES.DATA_UPDATE]: this.PRIORITY_LEVELS.NORMAL,
            [this.UPDATE_TYPES.CHANGES]: this.PRIORITY_LEVELS.NORMAL,
            [this.UPDATE_TYPES.INITIAL_STATE]: this.PRIORITY_LEVELS.CRITICAL,
            [this.UPDATE_TYPES.EVENT]: this.PRIORITY_LEVELS.HIGH
        }[type] || this.PRIORITY_LEVELS.NORMAL;
    }

    _sortUpdatesByPriority() {
        return [...this.pendingUpdates.entries()].sort((a, b) => {
            // Critical updates first (TimeAwaiter events)
            if (b[1].priority !== a[1].priority) {
                return b[1].priority - a[1].priority;
            }
            
            // Older updates first
            return a[1].timestamp - b[1].timestamp;
        });
    }

    _generateUpdateId(type) {
        return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    }

    _checkEmbedsReady(updateId, updateType, data) {
        if (this.parent.embeds.areEmbedsReady) return true;

        if (!this.findPendingUpdateOfType(updateType)) {
            this._queueUpdate(updateId, {
                type: updateType,
                data,
                timestamp: new Date(),
                retryCount: 0
            });
        }
        return false;
    }

    _scheduleBatchProcessing() {
        if (this.updateTimeout) clearTimeout(this.updateTimeout);
        this.updateTimeout = setTimeout(() => {
            this.processPendingUpdates();
        }, this.BATCH_TIMEOUT_MS);
    }

    _canProcessUpdates() {
        if (!this.parent.embeds.areEmbedsReady) {
            logger.debug('[UpdateProcessor] Embeds not ready - delaying updates');
            return false;
        }
        return this.pendingUpdates.size > 0;
    }

    _shouldProcessUpdate(update) {
        // Skip if we've had too many errors
        if (this.consecutiveErrors >= this.MAX_RETRIES) {
            logger.warn('Skipping update due to consecutive errors', {
                consecutiveErrors: this.consecutiveErrors
            });
            return false;
        }

        // Enforce minimum interval for non-critical updates
        if (update.priority < this.PRIORITY_LEVELS.HIGH && 
            this.lastSuccessfulUpdate && 
            (Date.now() - this.lastSuccessfulUpdate) < this.MIN_UPDATE_INTERVAL) {
            return false;
        }

        return true;
    }

    _getAffectedLines(changes) {
        const lines = new Set();
        changes.forEach(change => {
            if (change.type === 'line') lines.add(change.id);
            if (change.type === 'station') lines.add(change.line);
        });
        return lines;
    }

    _logChangeHistory(changes) {
        this.changeHistory.push({
            timestamp: new Date(),
            changes: this._sanitizeChanges(changes),
            affectedLines: Array.from(this._getAffectedLines(changes))
        });
    }

    _sanitizeChanges(changes) {
        return {
            ...changes,
            lines: changes.lines?.map(line => ({
                ...line,
                displayName: this.parent.announcer._getLineDisplayName(line.id)
            })),
            stations: changes.stations?.map(station => ({
                ...station,
                displayName: this.parent.announcer._getStationDisplayName(station.id)
            }))
        };
    }

    _emitBatchStart(batchId) {
        this.parent.emit('batchUpdateStarted', batchId);
        this._emitEvent(EventRegistry.BATCH_UPDATE_STARTED, {
            batchId,
            updateCount: this.pendingUpdates.size
        });
    }

    _emitBatchComplete(batchId) {
        this.currentBatchId = null;
        this.parent.emit('batchUpdateCompleted', batchId);
        this._emitEvent(EventRegistry.BATCH_UPDATE_COMPLETED, { batchId });
    }

    _logUpdateStart(updateId, update) {
        logger.debug(`[UpdateProcessor] Processing update ${updateId}`, {
            type: update.type,
            priority: update.priority || 0
        });
    }

    _finalizeSuccessfulUpdate(updateId, update, startTime) {
        this.pendingUpdates.delete(updateId);
        this.consecutiveErrors = 0;
        this.lastSuccessfulUpdate = Date.now();
        
        this.parent.emit('pendingUpdateProcessed', { 
            updateId, 
            type: update.type,
            durationMs: performance.now() - startTime
        });
    }

    _enforceUpdateInterval() {
        if (this.lastSuccessfulUpdate) {
            const elapsed = Date.now() - this.lastSuccessfulUpdate;
            if (elapsed < this.MIN_UPDATE_INTERVAL) {
                const delay = this.MIN_UPDATE_INTERVAL - elapsed;
                return new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        return Promise.resolve();
    }

    _handleUpdateError(updateId, error, context) {
        console.error(`[UpdateProcessor] Update ${updateId} failed`, {
            error: error,
            context
        });
        
        this.parent.emit('updateFailed', {
            updateId,
            error,
            timestamp: new Date()
        });
    }

    _handleBatchUpdateError(updateId, update, error) {
        logger.error(`[UpdateProcessor] Batch update failed`, {
            updateId,
            error: error.message,
            retryCount: update.retryCount
        });

        if (update.retryCount < this.MAX_RETRIES) {
            update.retryCount++;
            this.pendingUpdates.set(updateId, update);
        } else {
            this.pendingUpdates.delete(updateId);
            this.parent.emit('updateDiscarded', { updateId, type: update.type });
        }
    }

    _handleProcessingError(error, context) {
        console.error(`[UpdateProcessor] Processing error`, {
            context,
            error: error
        });
        this.parent.emit(`${context}ProcessingFailed`, error);
    }

    _handleBatchError(batchId, error) {
        this.consecutiveErrors++;
        logger.error('Batch processing failed', {
            batchId,
            error: error.message,
            consecutiveErrors: this.consecutiveErrors
        });
        this._emitEvent(EventRegistry.BATCH_UPDATE_FAILED, {
            batchId,
            error: error.message
        });
    }

    _emitEvent(event, data = {}) {
        this.parent.emit(event, new EventPayload(
            event,
            data,
            { source: 'UpdateProcessor' }
        ));
    }
}

module.exports = UpdateProcessor;
