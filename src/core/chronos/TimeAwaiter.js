// modules/chronos/TimeAwaiter.js
const TimeHelpers = require('./timeHelpers');
const AnnouncementService = require('./AnnouncementService');
const EventRegistry = require('../../core/EventRegistry');
const EventPayload = require('../../core/EventPayload');
const moment = require('moment');
const chronosConfig = require('../../config/chronosConfig');

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
        this._lastEventDay = false;
        this._lastExtendedHours = false;
    }

    // ======================
    // MAIN TIME CHECK METHOD
    // ======================
    async checkTime(service = null) {
        try {
            const current = this._getCurrentState();
            const now = this.timeHelpers.currentTime;
            const operatingHours = this.timeHelpers.getOperatingHours();
            const eventDetails = this.timeHelpers.getEventDetails();
            let apiService = service ? service : this.metroCore.api;

            // 1. EVENT DAY MANAGEMENT
            const isEventActive = this.timeHelpers.isSpecialEventActive();
            if (eventDetails) {
                if (isEventActive && !this._lastEventDay) {
                    await this.metroCore._subsystems.statusOverrideService.prepareEventOverrides(eventDetails);
                } 
                else if (!isEventActive && this._lastEventDay) {
                    await this.metroCore._subsystems.statusOverrideService.cleanupEventOverrides();
                }
                this._lastEventDay = isEventActive;
            }

            // 2. EXTENDED HOURS HANDLING
            const isExtendedHours = current.farePeriod === 'EXTENDED';
            if (isExtendedHours && !this._lastExtendedHours) {
                this._handleExtendedHoursTransition(true);
            } 
            else if (!isExtendedHours && this._lastExtendedHours) {
                this._handleExtendedHoursTransition(false);
            }
            this._lastExtendedHours = isExtendedHours;

            // 3. SERVICE HOURS TRANSITION
            if (current.isServiceRunning !== this._lastState.isServiceRunning) {
                this._handleServiceTransition(current.isServiceRunning, operatingHours);
            }

            // 4. FARE PERIOD TRANSITION
            if (current.farePeriod !== this._lastState.farePeriod && 
                current.farePeriod !== "NOCHE") {
                
                const periodInfo = current.farePeriod === "EXTENDED" ? {
                    type: "EXTENDED",
                    name: 'Horario Extendido',
                    start: operatingHours.closing,
                    end: eventDetails?.extendedHours?.closing || operatingHours.closing,
                    crossesMidnight: this.timeHelpers.willBeExtended()
                } : this.timeHelpers.getCurrentPeriod();
                
                this._handleFarePeriodChange(current.farePeriod, periodInfo);
            }

            // 5. EXPRESS SERVICE TRANSITION
            const currentExpress = this._getCurrentExpressState();

            if (currentExpress.morning !== this._lastExpressState.morning) {
                const transitionType = currentExpress.morning ? 'start' : 'end';
                this._handleExpressTransition(transitionType, 'morning');
            }

            if (currentExpress.evening !== this._lastExpressState.evening) {
                const transitionType = currentExpress.evening ? 'start' : 'end';
                this._handleExpressTransition(transitionType, 'evening');
            }

            // Update state trackers
            this._lastState = current;
            this._lastExpressState = currentExpress;

        } catch (error) {
            console.error('[TimeAwaiter] Error in checkTime:', error);
            this.metroCore.emit(EventRegistry.SYSTEM_ERROR, new EventPayload(
                'timeCheckFailed',
                { error: error.message },
                { source: 'TimeAwaiter' }
            ));
        }
    }

    // ======================
    // STATE GETTERS
    // ======================
    _getCurrentState() {
        const currentPeriod = this.timeHelpers.getCurrentPeriod();
        return {
            isServiceRunning: this.timeHelpers.isWithinOperatingHours(),
            farePeriod: currentPeriod.type,
            isExtendedHours: currentPeriod.type === 'EXTENDED'
        };
    }

    _getCurrentExpressState() {

        const isMorning = this.timeHelpers.isTimeBetween(
                moment(),
                chronosConfig.expressHours.morning.start,
                chronosConfig.expressHours.morning.end
            ) && this.timeHelpers.isWeekday();
  
        const isEvening = this.timeHelpers.isTimeBetween(
                moment(),
                chronosConfig.expressHours.evening.start,
                chronosConfig.expressHours.evening.end
            )  && this.timeHelpers.isWeekday();


        return {
            morning: isMorning,
            evening: isEvening, 
        };
    }

    // ======================
    // TRANSITION HANDLERS
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

    _handleFarePeriodChange(farePeriod, periodInfo) {
        if (farePeriod === 'EXTENDED') return;

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

    _emitTimeEvent(eventType, data) {
        const payload = new EventPayload(
            eventType,
            {
                ...data,
                context: {
                    ...data.context,
                    triggersEmbedRefresh: true,
                    refreshType: 'full',
                    priority: 'high'
                },
                metadata: {
                    source: 'TimeAwaiter',
                    timestamp: Date.now(),
                    isTimeCritical: true
                }
            }
        );

        this.metroCore.emit(eventType, payload);
        this.metroCore.emit(EventRegistry.EMBED_REFRESH_TRIGGERED, {
            ...payload,
            reason: `time_event:${eventType}`
        });
    }
}

module.exports = TimeAwaiter;
