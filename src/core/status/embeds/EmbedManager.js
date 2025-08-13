// modules/status/EmbedManager.js
const logger = require('../../../events/logger');
const StatusEmbeds = require('../../../config/statusEmbeds');
const TimeHelpers = require('../../chronos/timeHelpers');
const EventRegistry = require('../../../core/EventRegistry');
const EventPayload = require('../../../core/EventPayload');
const { setTimeout } = require('timers/promises');

function _transformToRawStation(station) {
    return {
        codigo: station.id,
        nombre: station.name,
        estado: station.status,
        descripcion: station.description,
        descripcion_app: station.description_app,
        combinacion: station.transfer || '',
    };
}

function _transformToRawLine(line) {
    return {
        estado: line.status,
        mensaje: line.message,
        mensaje_app: line.message_app,
        estaciones: line.stations?.map(_transformToRawStation) || [],
    };
}

class EmbedManager {
    constructor(statusUpdater) {
        this.parent = statusUpdater;
        this.embedMessages = new Map();
        this.isFetchingEmbeds = false;
        this.areEmbedsReady = false;
        this._updateQueue = new Map();
        this._lastUpdateTime = 0;
        this._updateLock = false;
        this._batchInterval = null;
    }

    async initialize() {
        try {
            await this.cacheEmbedMessages();
            this._setupUpdateBatching();
            logger.info('[EmbedManager] Initialization complete');
        } catch (error) {
            logger.fatal('[EmbedManager] Initialization failed', error);
            throw error;
        }
    }

    async cacheEmbedMessages() {
        if (this.isFetchingEmbeds) {
            logger.debug('[EmbedManager] Embed fetch already in progress');
            return;
        }
        
        this.isFetchingEmbeds = true;
        logger.system('[EmbedManager] Starting embed message caching');

        try {
            this._emitStatusUpdate(this.parent.UI_STRINGS.EMBEDS.CACHING);
            
            const channel = await this._fetchEmbedChannel();
            await this._fetchAllEmbedMessages(channel);

            this.areEmbedsReady = true;
           
            
            
            logger.system('[EmbedManager] All embeds cached', {
                totalCached: this.embedMessages.size
            });
            
            this._emitEvent(EventRegistry.EMBEDS_READY);
            await this.parent.processor.processPendingUpdates();
            
            if (!this.parent.metroCore.api) {
                logger.warn('[EmbedManager] MetroCore API not ready, waiting for SYSTEM_READY event.');
                await new Promise(resolve => this.parent.metroCore.once(EventRegistry.SYSTEM_READY, resolve));
                logger.info('[EmbedManager] SYSTEM_READY event received, proceeding with embed update.');
            }

           await this.updateAllEmbeds(this.parent.metroCore.api.getProcessedData()) 
            
        } catch (error) {
            logger.fatal('[EmbedManager] Failed to cache embeds', error);
            this._emitEvent(EventRegistry.EMBEDS_CACHE_FAILED, { error });
            throw error;
        } finally {
            this.isFetchingEmbeds = false;
        }
    }

    // In EmbedManager.js

/**
 * Updates all embeds with fresh data
 * @param {Object} [data] - Optional data to use (will fetch fresh if not provided)
 * @param {Object} [changes] - Optional changes object
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.force] - Whether to force update even if embeds aren't ready
 * @param {boolean} [options.bypassQueue] - Whether to bypass the update queue
 * @returns {Promise<void>}
 */
async updateAllEmbeds(data, changes = null, { force = false, bypassQueue = false } = {}) {
    // 1. Check if we should queue or proceed
    if (!this.areEmbedsReady && !force) {
        logger.debug('[EmbedManager] Embeds not ready, queuing update');
        this._queueUpdate('full', { data, changes });
        return;
    }

    if (this._updateLock && !bypassQueue) {
        logger.debug('[EmbedManager] Update in progress, queuing');
        this._queueUpdate('full', { data, changes });
        return;
    }

    // 2. Lock and prepare for update
    this._updateLock = true;
    const startTime = Date.now();
    
    try {
        logger.debug('[EmbedManager] Starting full embed update', {
            forceUpdate: force,
            bypassQueue: bypassQueue,
            hasChanges: !!changes
        });

        this._emitStatusUpdate(this.parent.UI_STRINGS.EMBEDS.UPDATING);
        this._emitEvent(EventRegistry.EMBED_REFRESH_STARTED);

        // 3. Always get fresh data for time-based updates
        const processedData = data || this.parent.metroCore?.api?.getProcessedData() || this.parent.metroCore.getCurrentData();

        // 4. Execute the full update cycle
        await this._executeBatchUpdate(processedData, changes);

        // 5. Emit completion events
        this._emitEvent(EventRegistry.EMBEDS_UPDATED);
        this._emitEvent(EventRegistry.EMBED_REFRESH_COMPLETED, {
            durationMs: Date.now() - startTime
        });
        this._emitStatusUpdate(this.parent.UI_STRINGS.EMBEDS.UPDATED);

        logger.info('[EmbedManager] Full embed update completed', {
            durationMs: Date.now() - startTime
        });

    } catch (error) {
        logger.error('[EmbedManager] Full update failed', error);
        this._emitEvent(EventRegistry.EMBED_REFRESH_FAILED, { 
            error: error.message 
        });
        this._emitStatusUpdate(
            this.parent.UI_STRINGS.EMBEDS.UPDATE_FAILED.replace('{type}', 'all')
        );
        throw error;
    } finally {
        // 6. Release lock and process any queued updates
        this._updateLock = false;
        if (bypassQueue) {
            await this._processQueuedUpdates();
        }
    }
}

// Add these to EventRegistry if not already present:
// EMBED_REFRESH_STARTED: 'embed:refresh_started',
// EMBED_REFRESH_COMPLETED: 'embed:refresh_completed', 
// EMBED_REFRESH_FAILED: 'embed:refresh_failed'

    async updateOverviewEmbed(data, changes = null) {
        try {
            if (!this.areEmbedsReady) return;
            
            logger.debug('[EmbedManager] Updating overview embed');
            this._emitStatusUpdate(this.parent.UI_STRINGS.EMBEDS.OVERVIEW_UPDATE);
            
            // Transform processed data to raw API structure for the embed function
            const rawLines = {};
            if (data && data.lines) {
                for (const lineKey in data.lines) {
                    rawLines[lineKey] = _transformToRawLine(data.lines[lineKey]);
                }
            }

            const embed = StatusEmbeds.overviewEmbed(
                rawLines,
                TimeHelpers.currentTime.format('HH:mm')
            );

            const message = this.embedMessages.get('overview');
            if (message && embed) {
                await this._safeEmbedEdit(message, embed);
                this._emitEvent(EventRegistry.OVERVIEW_UPDATED);
            }
        } catch (error) {
            logger.error('[EmbedManager] Overview update failed', error);
            this._emitStatusUpdate(
                this.parent.UI_STRINGS.EMBEDS.UPDATE_FAILED.replace('{type}', 'overview')
            );
            throw error;
        }
    }

    async updateAllLineEmbeds(data) {
        try {
            if (!data || !data.lines) {
                logger.warn('[EmbedManager] updateAllLineEmbeds called without line data. Skipping.');
                return;
            }
            
            logger.debug('[EmbedManager] Updating line embeds', {
                lineCount: Object.keys(data.lines).length
            });

            // Process in batches to avoid rate limits
            const BATCH_SIZE = 5;
            const lineKeys = Object.keys(data.lines);
            
            for (let i = 0; i < lineKeys.length; i += BATCH_SIZE) {
                const batch = lineKeys.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(lineKey => 
                    this.updateLineEmbed({
                        ...data.lines[lineKey],
                        _allStations: data.stations
                    })
                ));
                
                // Rate limit between batches
                if (i + BATCH_SIZE < lineKeys.length) {
                    await setTimeout(1000);
                }
            }
        } catch (error) {
            logger.error('[EmbedManager] Line updates failed', error);
            throw error;
        }
    }

    async updateLineEmbed(lineData) {
        try {
            const lineKey = lineData.id.toLowerCase();

            // Transform processed line data to raw API structure
            const rawLineData = _transformToRawLine(lineData);

            const embed = StatusEmbeds.lineEmbed(
                lineKey,
                rawLineData,
                TimeHelpers.currentTime.format('HH:mm')
            );
            
            const message = this.embedMessages.get(lineKey);
            if (message && embed) {
                await this._safeEmbedEdit(message, embed);
                this._emitEvent(EventRegistry.LINE_UPDATED, { lineId: lineData.id });
            }
        } catch (error) {
            logger.error(`[EmbedManager] Line ${lineData.id} update failed`, error);
            throw error;
        }
    }

    // ==================== PRIVATE METHODS ====================

    async _fetchEmbedChannel() {
        try {
            logger.debug('[EmbedManager] Fetching embed channel', {
                channelId: this.parent.metroCore.config.embedsChannelId
            });
            return await this.parent.client.channels.fetch(
                this.parent.metroCore.config.embedsChannelId
            );
        } catch (error) {
            logger.error('[EmbedManager] Channel fetch failed', error);
            throw new Error(this.parent.UI_STRINGS.SYSTEM.ERROR.CHANNEL_FETCH);
        }
    }

    async _fetchAllEmbedMessages(channel) {
        const fetchPromises = Object.entries(this.parent.metroCore.config.embedMessageIds).map(
            async ([embedName, messageId]) => {
                try {
                    const message = await channel.messages.fetch(messageId);
                    this.embedMessages.set(embedName, message);
                    logger.info(`[EmbedManager] Cached embed: ${embedName}`);
                    this._emitEvent(EventRegistry.EMBED_CACHED, { embedName });
                } catch (error) {
                    logger.error(`[EmbedManager] Failed to cache ${embedName}`, error);
                    this._emitEvent(EventRegistry.EMBED_CACHE_FAILED, { 
                        embedName, 
                        error: error.message 
                    });
                }
            }
        );

        await Promise.all(fetchPromises);
    }

    _prepareData(data) {
        return {
            network: data.network || {},
            lines: data.lines || {},
            stations: data.stations || {},
            lastUpdated: data.lastUpdated || TimeHelpers.currentTime.toISOString()
        };
    }

    async _executeBatchUpdate(data, changes) {
        // Throttle updates to prevent rate limiting
        const now = Date.now();
        if (now - this._lastUpdateTime < 1000) {
            await setTimeout(1000 - (now - this._lastUpdateTime));
        }

        await Promise.all([
            this.updateOverviewEmbed(data, changes),
            this.updateAllLineEmbeds(data)
        ]);
        
        this._lastUpdateTime = Date.now();
    }

    async _safeEmbedEdit(message, embed) {
        try {
            await message.edit({ embeds: [embed] });
        } catch (error) {
            if (error.code === 10008) { // Unknown Message
                logger.warn('[EmbedManager] Message missing, recaching embeds');
                this.areEmbedsReady = false;
                await this.cacheEmbedMessages();
                throw error;
            }
            throw error;
        }
    }

    _setupUpdateBatching() {
        this._batchInterval = setInterval(() => {
            if (this._updateQueue.size > 0 && !this._updateLock) {
                this._processQueuedUpdates();
            }
        }, 5000).unref();
    }

    _queueUpdate(type, data) {
        this._updateQueue.set(Date.now(), { type, data });
        logger.debug('[EmbedManager] Update queued', { 
            type,
            queueSize: this._updateQueue.size 
        });
    }

    async _processQueuedUpdates() {
        if (this._updateQueue.size === 0 || this._updateLock) return;

        this._updateLock = true;
        try {
            logger.debug('[EmbedManager] Processing queued updates', {
                count: this._updateQueue.size
            });

            for (const [timestamp, { type, data }] of this._updateQueue) {
                try {
                    switch (type) {
                        case 'full':
                            await this.updateAllEmbeds(data.data, data.changes);
                            break;
                        case 'overview':
                            await this.updateOverviewEmbed(data.data, data.changes);
                            break;
                        case 'line':
                            await this.updateLineEmbed(data);
                            break;
                    }
                    this._updateQueue.delete(timestamp);
                } catch (error) {
                    logger.error('[EmbedManager] Queued update failed', {
                        type,
                        error: error.message
                    });
                    // Keep failed updates in queue for retry
                }
            }
        } finally {
            this._updateLock = false;
        }
    }

    _emitStatusUpdate(status) {
        this.parent.emit(EventRegistry.STATUS_UPDATE, 
            new EventPayload(
                EventRegistry.STATUS_UPDATE,
                { status },
                { source: 'EmbedManager' }
            )
        );
    }

    _emitEvent(event, data = {}) {
        this.parent.emit(event, 
            new EventPayload(
                event,
                data,
                { source: 'EmbedManager' }
            )
        );
    }

    // ==================== CLEANUP ====================

    async shutdown() {
        clearInterval(this._batchInterval);
        this._updateQueue.clear();
        logger.info('[EmbedManager] Shutdown complete');
    }

    
    async refreshAllEmbeds() {
    try {
        logger.debug('[EmbedManager] Starting full refresh');
        const currentData = this.parent.metroCore.api.getProcessedData();
        
        // Bypass normal queue for time-critical updates
        if (this._updateLock) {
            this._updateQueue.clear(); // Clear any pending updates
        }
        
        await this.updateAllEmbeds(currentData);
        this._emitEvent(EventRegistry.EMBED_REFRESH_COMPLETED);
    } catch (error) {
        logger.error('[EmbedManager] Refresh failed', error);
        this._emitEvent(EventRegistry.EMBED_REFRESH_FAILED, { error });
        throw error;
    }

    }}

module.exports = EmbedManager;