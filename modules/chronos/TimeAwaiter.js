// modules/chronos/TimeAwaiter.js
// modules/chronos/AnnouncementAwaiter.js
// modules/chronos/TimeAwaiter.js
// modules/chronos/TimeAwaiter.js
// modules/chronos/TimeAwaiter.js
// modules/chronos/TimeAwaiter.js
// modules/chronos/TimeAwaiter.js
const TimeHelpers = require('./timeHelpers');
const AnnouncementService = require('./AnnouncementService');
const EventRegistry = require('../../core/EventRegistry');
const EventPayload = require('../../core/EventPayload');
const moment = require('moment');
const chronosConfig = require('../../config/chronosConfig');
const metroConfig = require('../../config/metro/metroConfig');

class TimeAwaiter {
    constructor(metroCore) {
        if (!metroCore) throw new Error('MetroCore instance is required');
        
        this.metroCore = metroCore;
        this.timeHelpers = TimeHelpers;
        this.announcementService = new AnnouncementService();
        
        // State tracking
        this._lastState = this._getCurrentState();
        this._lastExpressState = this._getCurrentExpressState();
        this._transitionBuffer = 5; // minutes buffer for transitions
        this._announcementCooldowns = new Map();
        this._lastEventEmission = {};
    }

    // ======================
    // MAIN TIME CHECK METHOD
    // ======================
    // Add to TimeAwaiter class

// ======================
// EXTENDED HOURS HANDLING
// ======================
_handleExtendedHoursTransition(isStarting) {
    const announcementKey = `extended-${isStarting ? 'start' : 'end'}`;
    
    if (this._checkCooldown(announcementKey)) {
        console.log(`[TimeAwaiter] Extended hours announcement in cooldown`);
        return;
    }

    console.log(`[TimeAwaiter] Handling extended hours ${isStarting ? 'start' : 'end'}`);
    
    const eventDetails = this.timeHelpers.getEventDetails();
    if (!eventDetails) return;

    if (isStarting) {
        // Prepare overrides for extended hours
        this._prepareExtendedHoursOverrides(eventDetails);
    } else {
        // Clean up overrides after extended hours
        this._cleanupExtendedHoursOverrides();
    }

    this._emitTimeEvent(
        isStarting ? EventRegistry.EXTENDED_HOURS_START : EventRegistry.EXTENDED_HOURS_END,
        {
            eventName: eventDetails.name,
            extendedHours: eventDetails.extendedHours,
            affectedStations: eventDetails.closedStations,
            operationalStations: eventDetails.operationalStations
        }
    );

    this._logAnnouncementSuccess(announcementKey);
}

_prepareExtendedHoursOverrides(eventDetails) {
    //const overrideService = this.metroCore.getService('StatusOverrideService');
    //if (!overrideService) return;

    /*// Create overrides for closed stations
    Object.entries(eventDetails.closedStations || {}).forEach(([lineId, stations]) => {
        stations.forEach(stationId => {
            overrideService.addOverride('stations', stationId, {
                enabled: false, // Initially disabled
                estado: "4", // Suspended
                descripcion: "Cerrada por evento especial",
                descripcion_app: "Closed for special event",
             //   isTransferOperational: false
            });
        });
    });

    // Create overrides for affected lines
    Object.keys(eventDetails.closedStations || {}).forEach(lineId => {
        overrideService.addOverride('lines', lineId, {
            enabled: false, // Initially disabled
            estado: "3", // Partial service
            mensaje: `Servicio afectado por evento en ${eventDetails.name}`,
            mensaje_app: `Service affected by ${eventDetails.name} event`,
            expressSupressed: true
        });
    });*/

    console.log('[TimeAwaiter] Prepared extended hours overrides (disabled)');
}


    // In TimeAwaiter class

async _activateExtendedHoursOverrides(eventDetails) {
    const apiService = this.metroCore.api;
    if (!apiService) {
        console.error('[TimeAwaiter] Could not access ApiService');
        return;
    }

    const lineOverrides = {};
    const stationOverrides = {};

    // Prepare line overrides
    Object.keys(eventDetails.closedStations || {}).forEach(lineId => {
        lineOverrides[lineId] = {
            estado: EXTENSION_LINE_STATUS,
            mensaje: `Servicio afectado por evento en ${eventDetails.name}`,
            mensaje_app: `Service affected by ${eventDetails.name} event`,
            enabled: true
        };
    });

    // Prepare station overrides
    Object.entries(eventDetails.closedStations || {}).forEach(([lineId, stations]) => {
        stations.forEach(stationId => {
            stationOverrides[stationId] = {
                estado: EXTENSION_STATION_STATUS,
                descripcion: "Cerrada por evento especial",
                descripcion_app: "Closed for special event",
                enabled: true
            };
        });
    });

    // Apply updates
    await apiService.updateOverrides({
        lines: lineOverrides,
        stations: stationOverrides
    }).then(success => {
        if (success) {
            console.log('[TimeAwaiter] Extended hours overrides activated');
        } else {
            console.error('[TimeAwaiter] Failed to activate extended hours overrides');
        }
    });
}

async _cleanupExtendedHoursOverrides(eventDetails) {
    const apiService = this.metroCore.api;
    if (!apiService) {
        console.error('[TimeAwaiter] Could not access ApiService');
        return;
    }

    const removals = {
        lines: Object.keys(eventDetails.closedStations || {}),
        stations: Object.values(eventDetails.closedStations || {}).flat()
    };

    // Apply removals
    await apiService.removeOverrides(removals).then(success => {
        if (success) {
            console.log('[TimeAwaiter] Extended hours overrides cleaned up');
        } else {
            console.error('[TimeAwaiter] Failed to clean up extended hours overrides');
        }
    });
}

// ======================
// MODIFIED FARE PERIOD HANDLING
// ======================
_handleFarePeriodChange(farePeriod, periodInfo) {
    // Check if we're transitioning to extended hours
    if (farePeriod === 'EXTENSION') {
        this._activateExtendedHoursOverrides();
        return;
    }

    // Original fare period handling
    const announcementKey = `fare-${farePeriod}`;
    
    if (this._checkCooldown(announcementKey)) {
        console.log(`[TimeAwaiter] Fare period announcement in cooldown`);
        return;
    }

    console.log(`[TimeAwaiter] Executing ${farePeriod} fare announcement`);
    
    this.announcementService.announceFarePeriodChange(farePeriod, periodInfo)
    .then(() => {
        this._logAnnouncementSuccess(announcementKey);
        
        this._emitTimeEvent(EventRegistry.FARE_PERIOD_ADVANCE, {
            periodType: farePeriod,
            name: periodInfo.name,
            start: periodInfo.start,
            end: periodInfo.end
        });

        this._triggerFarePeriodEffects(farePeriod);
    })
    .catch(err => {
        console.error('[TimeAwaiter] Fare announcement failed:', err);
        this.metroCore.emit(EventRegistry.ANNOUNCEMENT_FAILED, new EventPayload(
            'farePeriodChangeFailed',
            { error: err.message },
            { source: 'TimeAwaiter' }
        ));
    });
}

// ======================
// MODIFIED TIME CHECK METHOD
// ======================

async checkTime(service = null) {
    try {
        const current = this._getCurrentState();
        const now = this.timeHelpers.currentTime;
        const operatingHours = this.timeHelpers.getOperatingHours();
        const eventDetails = this.timeHelpers.getEventDetails();
        let apiService = service ? service : this.metroCore.api;

        
        
        console.log(`[TimeAwaiter] Checking time at ${now.format('YYYY-MM-DD HH:mm:ss')}`);
        console.log(`[TimeAwaiter] Current state:`, current);
        console.log(`[TimeAwaiter] Last state:`, this._lastState);

        // 1. EVENT DAY MANAGEMENT (24-hour aware)
        // In checkTime method, replace the event day management section with:

// 1. EVENT DAY MANAGEMENT (24-hour aware)
if (eventDetails) {
    const eventDate = moment(eventDetails.date);
    const eventEnd = moment(eventDetails.date).add(1, 'day'); // Event can span to next day
    
    // Check if we're within the event period (current day or next day before end time)
    const isEventDay = now.isBetween(eventDate, eventEnd, null, '[]');

    // Prepare overrides when entering event day window
    if (isEventDay && !this._lastEventDay) {
        console.log('[TimeAwaiter] Event period started - preparing overrides');
        await apiService.prepareEventOverrides(eventDetails);
    } 
    // Clean up when completely past event period
    else if (!isEventDay && this._lastEventDay) {
        console.log('[TimeAwaiter] Event period completely ended - cleaning up');
        await apiService.cleanupEventOverridesIfNeeded(eventDetails);
    }
    this._lastEventDay = isEventDay;

    // Check if we're in event period but before normal operating hours
    if (isEventDay && !this.timeHelpers.isWithinOperatingHours()) {
        const eventStart = moment(`${eventDetails.date} ${eventDetails.startTime || '00:00'}`);
        const normalOpening = moment(`${eventDetails.date} ${operatingHours.opening}`);
        const extendedClosing = eventDetails.extendedHours ? 
            moment(`${eventDetails.date} ${eventDetails.extendedHours.closing}`) : null;
        
        // Handle case where we're after midnight but still in extended hours
        if (extendedClosing && now.isAfter(normalOpening.clone().add(1, 'day'))) {
            // Still in extended hours period after midnight
            console.log('[TimeAwaiter] Post-midnight extended hours period - keeping overrides');
            this._lastExtendedHours = true;
            current.farePeriod = "EXTENDIDO";
        }
        else if (now.isBetween(eventStart, normalOpening)) {
            console.log('[TimeAwaiter] Pre-operating hours event period - activating overrides');
            await apiService.activateEventOverrides(eventDetails);
            this._lastExtendedHours = true;
            current.farePeriod = "EXTENDIDO";
        }
    }
}

        // 2. EXTENDED HOURS HANDLING (midnight-crossing support)
  // In the extended hours handling section, replace with:

// 2. EXTENDED HOURS HANDLING (midnight-crossing support)
let isExtendedHours = false;
if (eventDetails?.extendedHours) {
    const operatingEnd = moment(operatingHours.closing, 'HH:mm');
    const extendedClosing = moment(eventDetails.extendedHours.closing, 'HH:mm');
    
    // Create moment objects for today's times
    const todayOperatingEnd = now.clone()
        .set({
            hour: operatingEnd.hours(),
            minute: operatingEnd.minutes(),
            second: 0
        });
    
    const todayExtendedClosing = now.clone()
        .set({
            hour: extendedClosing.hours(),
            minute: extendedClosing.minutes(),
            second: 0
        });
    
    // Handle cases where extended hours cross midnight
    if (extendedClosing.isBefore(operatingEnd)) {
        // Extended hours cross midnight (e.g. 23:30 -> 01:00)
        isExtendedHours = now.isSameOrAfter(todayOperatingEnd) || 
                         now.isBefore(todayExtendedClosing);
    } else {
        // Normal case (e.g. 23:30 -> 00:30)
        isExtendedHours = now.isSameOrAfter(todayOperatingEnd) && 
                         now.isBefore(todayExtendedClosing);
    }

    // Activate overrides when entering extended hours
    if (isExtendedHours && !this._lastExtendedHours) {
        console.log('[TimeAwaiter] Extended hours started - activating overrides');
        await apiService.activateEventOverrides(eventDetails);
        this._handleExtendedHoursTransition(true);
    } 
    // Deactivate when leaving extended hours
    else if (!isExtendedHours && this._lastExtendedHours) {
        console.log('[TimeAwaiter] Extended hours ended');
        this._handleExtendedHoursTransition(false);
    }
    this._lastExtendedHours = isExtendedHours;

    // Set special fare period during extended hours
    if (isExtendedHours && current.farePeriod !== "EXTENDIDO") {
        current.farePeriod = "EXTENDIDO";
    }
}

        // 3. SERVICE HOURS TRANSITION (midnight-aware)
        if (current.isServiceRunning !== this._lastState.isServiceRunning) {
            console.log(`[TimeAwaiter] Service running state changed from ${this._lastState.isServiceRunning} to ${current.isServiceRunning}`);
            this._handleServiceTransition(current.isServiceRunning, operatingHours);
        }

        // 4. FARE PERIOD TRANSITION (with midnight extension support)
        if (current.farePeriod !== this._lastState.farePeriod && 
            current.farePeriod !== "NOCHE") {
            
            const periodInfo = current.farePeriod === "EXTENDIDO" ? {
                type: "EXTENDIDO",
                name: 'Horario Extendido',
                start: operatingHours.closing,
                end: eventDetails?.extendedHours?.closing || operatingHours.closing,
                crossesMidnight: this._doesExtensionCrossMidnight(eventDetails)
            } : this.timeHelpers.getCurrentPeriod();
            
            console.log(`[TimeAwaiter] Fare period changed from ${this._lastState.farePeriod} to ${current.farePeriod}`);
            this._handleFarePeriodChange(current.farePeriod, periodInfo);
        }

        // 5. EXPRESS SERVICE TRANSITION
        const currentExpress = this._getCurrentExpressState();
        console.log(`[TimeAwaiter] Current express state:`, currentExpress);

        if (currentExpress.morning !== this._lastExpressState.morning) {
            const transitionType = currentExpress.morning ? 'start' : 'end';
            console.log(`[TimeAwaiter] Handling morning express ${transitionType}`);
            this._handleExpressTransition(transitionType, 'morning');
        }

        if (currentExpress.evening !== this._lastExpressState.evening) {
            const transitionType = currentExpress.evening ? 'start' : 'end';
            console.log(`[TimeAwaiter] Handling evening express ${transitionType}`);
            this._handleExpressTransition(transitionType, 'evening');
        }

        // Update state trackers
        this._lastState = current;
        this._lastExpressState = currentExpress;

        // 6. SAFETY CLEANUP (24-hour window)
        if (!eventDetails && (Object.keys(this._lastOverrides?.lines || {}).length > 0 || 
                             Object.keys(this._lastOverrides?.stations || {}).length > 0)) {
            console.log('[TimeAwaiter] Safety cleanup - removing stale overrides');
            await apiService.cleanupEventOverridesIfNeeded();
        }

    } catch (error) {
        console.error('[TimeAwaiter] Error in checkTime:', error);
        this.metroCore.emit(EventRegistry.SYSTEM_ERROR, new EventPayload(
            'timeCheckFailed',
            { error: error.message },
            { source: 'TimeAwaiter' }
        ));
    }
}
// Helper method to detect midnight crossings
_doesExtensionCrossMidnight(eventDetails) {
    if (!eventDetails?.extendedHours) return false;
    const closing = moment(eventDetails.extendedHours.closing, 'HH:mm');
    const operatingEnd = moment(this.timeHelpers.getOperatingHours().closing, 'HH:mm');
    return closing.isBefore(operatingEnd);
}

// ======================
// MODIFIED STATE GETTER
// ======================
_getCurrentState() {
    const baseState = {
        isServiceRunning: this.timeHelpers.isWithinOperatingHours(),
        farePeriod: this.timeHelpers.getCurrentPeriod().type
    };

    // Check for extended hours (with midnight crossing support)
    const eventDetails = this.timeHelpers.getEventDetails();
    if (eventDetails?.extendedHours) {
        const now = this.timeHelpers.currentTime;
        const operatingHours = this.timeHelpers.getOperatingHours();
        
        // Create moments for the time comparisons
        const closingTime = moment(eventDetails.extendedHours.closing, 'HH:mm');
        const operatingEnd = moment(operatingHours.closing, 'HH:mm');
        
        // Handle midnight crossing
        if (closingTime.isBefore(operatingEnd)) {
            // Extended hours cross midnight (e.g., 23:30 -> 01:00)
            baseState.isExtendedHours = now.isSameOrAfter(operatingEnd) || 
                                     now.isBefore(closingTime);
        } else {
            // Normal case (e.g., 23:30 -> 00:30)
            baseState.isExtendedHours = now.isSameOrAfter(operatingEnd) && 
                                     now.isBefore(closingTime);
        }

        if (baseState.isExtendedHours) {
            baseState.farePeriod = 'EXTENDIDO';
        }
    }

    return baseState;
}
    // ======================
    // STATE GETTERS
    // ======================
    

    _getCurrentExpressState() {
        const currentTimeStr = this.timeHelpers.currentTime.format('HH:mm');
        
        if (!this.timeHelpers.isWeekday()) {
            return { morning: false, evening: false };
        }

        return {
            morning: this.timeHelpers.isTimeBetween(
                this.timeHelpers.currentTime,
                chronosConfig.expressHours.morning.start,
                chronosConfig.expressHours.morning.end
            ),
            evening: this.timeHelpers.isTimeBetween(
                this.timeHelpers.currentTime,
                chronosConfig.expressHours.evening.start,
                chronosConfig.expressHours.evening.end
            )
        };
    }

    // ======================
    // TIME HELPERS
    // ======================
    _getFarePeriodTransitionTime(periodType) {
        const periods = chronosConfig.farePeriods[periodType] || [];
        const currentTime = this.timeHelpers.currentTime.format('HH:mm');
        
        for (const period of periods) {
            if (this.timeHelpers.isTimeBetween(
                this.timeHelpers.currentTime,
                period.start,
                period.end
            )) {
                return period.start;
            }
        }
        
        return periodType === 'PUNTA' ? '07:00' : '09:00';
    }

    _getPeriodEndTime(periodType) {
        const periods = chronosConfig.farePeriods[periodType] || [];
        const currentTime = this.timeHelpers.currentTime.format('HH:mm');
        
        for (const period of periods) {
            if (this.timeHelpers.isTimeBetween(
                this.timeHelpers.currentTime,
                period.start,
                period.end
            )) {
                return period.end;
            }
        }
        
        return periodType === 'PUNTA' ? '20:00' : '23:00';
    }

    // ======================
    // ANNOUNCEMENT HANDLERS
    // ======================
    _handleServiceTransition(isStarting, operatingHours) {
        const announcementKey = `service-${isStarting ? 'start' : 'end'}`;
        
        if (this._checkCooldown(announcementKey)) {
            console.log(`[TimeAwaiter] Announcement ${announcementKey} is in cooldown`);
            return;
        }

        console.log(`[TimeAwaiter] Executing service ${isStarting ? 'start' : 'end'} announcement`);
        
        this.announcementService.announceServiceTransition(
            isStarting ? 'start' : 'end',
            operatingHours
        )
        .then(() => {
            this._logAnnouncementSuccess(announcementKey);
            
            const eventType = isStarting 
                ? EventRegistry.SERVICE_HOURS_START 
                : EventRegistry.SERVICE_HOURS_END;
            
            this._emitTimeEvent(eventType, {
                type: isStarting ? 'start' : 'end',
                opening: operatingHours.opening,
                closing: operatingHours.closing,
                isExtended: operatingHours.isExtended
            });

            this.metroCore.setState({
                serviceRunning: isStarting,
                lastServiceChange: new Date()
            });

            this._triggerServiceChangeEffects(isStarting);
        })
        .catch(err => {
            console.error('[TimeAwaiter] Service announcement failed:', err);
            this.metroCore.emit(EventRegistry.ANNOUNCEMENT_FAILED, new EventPayload(
                'serviceTransitionFailed',
                { error: err.message },
                { source: 'TimeAwaiter' }
            ));
        });
    }

    
    
    _handleExpressTransition(type, period) {
        const announcementKey = `express-${period}-${type}`;
        
        if (this._checkCooldown(announcementKey)) {
            console.log(`[TimeAwaiter] Express announcement in cooldown`);
            return;
        }

        console.log(`[TimeAwaiter] Executing ${period} express ${type} announcement`);
        
        this.announcementService.announceExpressTransition(type, period)
        .then(() => {
            this._logAnnouncementSuccess(announcementKey);
            
            const eventType = type === 'start' 
                ? EventRegistry.EXPRESS_START 
                : EventRegistry.EXPRESS_END;
            
            this._emitTimeEvent(eventType, {
                period: period,
                active: type === 'start',
                startTime: chronosConfig.expressHours[period].start,
                endTime: chronosConfig.expressHours[period].end,
                affectedLines: chronosConfig.expressLines
            });

            this.metroCore.emit(EventRegistry.TRAIN_SCHEDULE_UPDATE, {
                expressActive: type === 'start',
                period: period,
                lines: chronosConfig.expressLines
            });
        })
        .catch(err => {
            console.error('[TimeAwaiter] Express announcement failed:', err);
            this.metroCore.emit(EventRegistry.ANNOUNCEMENT_FAILED, new EventPayload(
                'expressTransitionFailed',
                { error: err.message },
                { source: 'TimeAwaiter' }
            ));
        });
    }

    // ======================
    // DOWNSTREAM EFFECTS
    // ======================
    _triggerServiceChangeEffects(isStarting) {
        this.metroCore.emit(EventRegistry.OPERATIONAL_MODE_CHANGE, {
            serviceRunning: isStarting,
            effectiveTime: new Date()
        });

        this.metroCore.emit(EventRegistry.STATION_STATUS_UPDATE, {
            serviceActive: isStarting,
            timestamp: new Date()
        });

        console.log(`[TimeAwaiter] Service ${isStarting ? 'start' : 'stop'} effects triggered`);
    }

    _triggerFarePeriodEffects(period) {
        const isPeak = period === 'PUNTA';
        
        this.metroCore.emit(EventRegistry.FARE_UPDATE, {
            isPeak,
            effective: new Date()
        });

        this.metroCore.emit(EventRegistry.DISPLAY_UPDATE, {
            type: 'farePeriod',
            period,
            timestamp: new Date()
        });

        this.metroCore.emit(EventRegistry.MAINTENANCE_MODE_UPDATE, {
            peakHours: isPeak
        });

        console.log(`[TimeAwaiter] ${period} period effects triggered`);
    }

    // ======================
    // UTILITY METHODS
    // ======================
    _checkCooldown(key) {
        const lastAnnounced = this._announcementCooldowns.get(key);
        if (!lastAnnounced) return false;
        
        const cooldown = 30 * 60 * 1000; // 30 minutes cooldown
        return (Date.now() - lastAnnounced) < cooldown;
    }

    _logAnnouncementSuccess(key) {
        this._announcementCooldowns.set(key, Date.now());
        console.log(`[TimeAwaiter] Announcement ${key} completed successfully`);
    }

    // Enhanced time event emission
_emitTimeEvent(eventType, data) {
    const payload = new EventPayload(
        eventType,
        {
            ...data,
            context: {
                ...data.context,
                triggersEmbedRefresh: true,
                refreshType: 'full', // 'full' or 'targeted'
                priority: 'high'     // 'high'|'normal'|'low'
            },
            metadata: {
                source: 'TimeAwaiter',
                timestamp: Date.now(),
                isTimeCritical: true
            }
        }
    );

    // Main event emission (e.g. SERVICE_HOURS_START)
    this.metroCore.emit(eventType, payload); 
    
    // Dedicated refresh trigger
    this.metroCore.emit(EventRegistry.EMBED_REFRESH_TRIGGERED, {
        ...payload,
        reason: `time_event:${eventType}`
    });
}
    
}

module.exports = TimeAwaiter;
