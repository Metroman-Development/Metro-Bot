// core/EventRegistry.js
// core/EventRegistry.js
/**
 * Centralized event registry for all system events
 * Organized by functional categories with clear documentation
 */

module.exports = {
    // ======================
    // CORE SYSTEM EVENTS
    // ======================
    SYSTEM_READY: 'system:ready',               // When all subsystems are initialized
    SYSTEM_SHUTDOWN: 'system:shutdown',         // Graceful shutdown initiated
    FATAL_ERROR: 'system:fatal_error',          // Critical unrecoverable error
    ERROR: 'system:error',                      // General non-fatal errors
    HEALTH_CHECK: 'system:health_check',        // Periodic health ping
    SYSTEM_CHANGES: 'system:changes',           // Major system state changes
    SAFE_MODE_ENTERED: 'system:safe_mode_entered', // After >5 consecutive errors
    SAFE_MODE_EXITED: 'system:safe_mode_exited',
    BACKPRESSURE_ACTIVE: 'system:backpressure_active', // Event listener overload
    STATUS_REPORT: 'system:status_report',      // Periodic system status summary
    SYSTEM_INIT: 'system:init',                 // Static data loaded (pre-polling)

    // ======================
    // TIME-BASED EVENTS
    // ======================
    DAY_TYPE_CHANGE: 'time:day_type_change',    // Weekday/weekend/holiday transitions
    SERVICE_HOURS_START: 'time:service_start',  // Metro service begins operating
    SERVICE_HOURS_END: 'time:service_end',      // Metro service stops operating
    EXPRESS_START: 'time:express_start',        // Morning/evening express begins
    EXPRESS_END: 'time:express_end',            // Morning/evening express ends
    FARE_PERIOD_ADVANCE: 'time:fare_period_advance', // Fare period change (PUNTA/LLANO/NOCHE)
    SERVICE_TRANSITION: 'schedule:service_transition', // Generic service state change
    FARE_PERIOD_CHANGE: 'schedule:fare_period_change', // Deprecated (use FARE_PERIOD_ADVANCE)

    // ======================
    // DATA FLOW EVENTS
    // ======================
    RAW_DATA_FETCHED: 'data:raw_fetched',       // Raw API data received
    RAW_DATA_PROCESSED: 'data:raw_processed',   // Raw data parsed
    DATA_PROCESSED: 'data:processed',           // Data transformed to internal format
    DATA_UPDATED: 'data:updated',               // New data available system-wide
    DATA_STALE: 'data:stale',                   // Data hasn't updated in expected window
    DATA_LOADED: 'data:loaded',                 // Initial data load complete
    DATA_ERROR: 'data:error',                   // Data processing failure
    DATA_VALIDATION_FAILED: 'data:validation_failed',
    STATION_NOT_FOUND: 'data:station_not_found',
    LINE_NOT_FOUND: 'data:line_not_found',
    INVALID_LINE_DATA: 'data:invalid_line_data',
    INITIAL_DATA_READY: 'data:initial_ready',   // First successful data combination
    STATUS_DATA_LOADED: 'data:status_loaded',   // Config/status data loaded
    DETAILS_DATA_LOADED: 'data:details_loaded', // API data processed
    DATA_COMBINED: 'data:combined',             // Status + details merge complete

    // ======================
    // NETWORK EVENTS
    // ======================
    NETWORK_STATUS_CHANGED: 'network:status_changed', // Overall network state change
    NETWORK_DEGRADED: 'network:degraded',       // Partial outages detected

    // ======================
    // API EVENTS
    // ======================
    API_READY: 'api:ready',                     // API subsystem initialized
    API_CONNECTED: 'api:connected',             // Successful API connection
    API_DISCONNECTED: 'api:disconnected',       // API connection lost
    API_RATE_LIMITED: 'api:rate_limited',       // Rate limit hit
    FETCH_COMPLETE: 'api:fetch_complete',       // API request finished
    API_CONFIG_UPDATED: 'api:config_updated',   // API configuration changed
    API_BACKOFF_STARTED: 'api:backoff_started', // Retry delay activated
    API_BACKOFF_ENDED: 'api:backoff_ended',
    API_RETRY_ATTEMPT: 'api:retry_attempt',     // Individual retry attempt
    API_CACHE_USED: 'api:cache_used',           // Falling back to cached data

    // ======================
    // CHANGE DETECTION
    // ======================
    CHANGES_DETECTED: 'change:detected',        // Differences from previous state
    CHANGE_ANALYSIS_STARTED: 'change:analysis_started',
    CHANGE_SEVERITY_UPDATED: 'change:severity_updated',
    INITIAL_STATE: 'change:initial_state',      // First-run baseline state
    CHANGE_ANNOUNCEMENTS_READY: 'change:announcements_ready', // Processed messages
    SEVERITY_CLASSIFIED: 'change:severity_classified', // Severity calculated

    // ======================
    // EMBED EVENTS
    // ======================
    EMBED_GENERATED: 'embed:generated',         // New embed created
    EMBED_FAILED: 'embed:failed',               // Embed generation failure
    EMBED_SENT: 'embed:sent',                   // Embed posted to destination
    EMBED_UPDATED: 'embed:updated',             // Existing embed modified
    EMBED_INITIALIZED: 'embed:initialized',     // Embed system ready
    EMBED_REFRESH_STARTED: 'embed:refresh_started', // Manual refresh triggered
    EMBED_REFRESH_COMPLETED: 'embed:refresh_completed',
    EMBED_PARTIAL_UPDATE: 'embed:partial_update', // Subset of embeds updated
    EMBED_RENDER_DELAYED: 'embed:render_delayed', // Backpressure affecting render
    EMBED_STALE_CONTENT: 'embed:stale_content', // Showing outdated data
    // In EventRegistry.js - Add these to the EMBED EVENTS section:

// ======================
// EMBED EVENTS (Additions)
// ======================
EMBED_REFRESH_TRIGGERED: 'embed:refresh_triggered',      // When refresh is initiated
EMBED_REFRESH_STARTED: 'embed:refresh_started',          // When refresh begins processing
EMBED_REFRESH_COMPLETED: 'embed:refresh_completed',      // When all embeds finished updating
EMBED_REFRESH_FAILED: 'embed:refresh_failed',            // When refresh fails
EMBED_FORCE_REFRESH: 'embed:force_refresh',              // When forced refresh requested
EMBED_QUEUE_CLEARED: 'embed:queue_cleared',              // When pending updates are purged
EMBED_BATCH_STARTED: 'embed:batch_started',              // When batch processing begins
EMBED_BATCH_COMPLETED: 'embed:batch_completed',          // When batch processing finishes
EMBED_UPDATE_SKIPPED: 'embed:update_skipped',            // When non-critical update is deferred


    // ======================
    // ENTITY STATUS EVENTS
    // ======================
    LINE_STATUS_CHANGED: 'entity:line_status_changed',
    STATION_STATUS_CHANGED: 'entity:station_status_changed',
    ENTITY_NOT_FOUND: 'entity:not_found',

    // ======================
    // MANAGER EVENTS
    // ======================
    STATION_MANAGER_READY: 'manager:station_ready',
    LINE_MANAGER_READY: 'manager:line_ready',
    MANAGER_DATA_UPDATED: 'manager:data_updated', // Manager.process() complete
    MANAGER_ERROR: 'manager:error',              // Validation/processing errors

    // ======================
    // VALIDATION EVENTS
    // ======================
    VALIDATION_STARTED: 'validation:started',
    VALIDATION_PASSED: 'validation:passed',
    VALIDATION_FAILED: 'validation:failed',
    VALIDATION_BYPASSED: 'validation:bypassed',
    PAYLOAD_VALIDATED: 'validation:payload_validated', // EventPayload validated
    SCHEMA_VERSION_MISMATCH: 'validation:schema_mismatch', // Data version conflict

    // ======================
    // MEMORY MANAGEMENT
    // ======================
    MEMORY_WARNING: 'memory:warning',           // Usage exceeds thresholds
    LISTENER_LEAK_DETECTED: 'memory:listener_leak',
    EVENT_LOOP_STRAIN: 'memory:event_loop_strain',

    // ======================
    // QUEUE MANAGEMENT
    // ======================
    QUEUE_ERROR_LIMIT: 'queue:error_limit',     // Too many failed items
    QUEUE_FULL: 'queue:full',                   // Queue capacity reached
    QUEUE_DRAINED: 'queue:drained',             // All items processed
    QUEUE_ITEM_PROCESSED: 'queue:item_processed',
    QUEUE_ITEM_FAILED: 'queue:item_failed',

    // ======================
    // POLLING EVENTS
    // ======================
    POLL_STARTED: 'poll:started',               // Polling cycle begins
    POLL_SUCCESS: 'poll:success',               // Poll completed successfully
    POLL_FAILURE: 'poll:failure',               // Poll failed
    POLL_BACKOFF: 'poll:backoff',               // Polling delayed due to errors
    POLL_STOPPED: 'poll:stopped',               // Polling intentionally halted

    // ======================
    // LISTENER MANAGEMENT
    // ======================
    LISTENER_ADDED: 'listener:added',
    LISTENER_REMOVED: 'listener:removed',
    LISTENER_ERROR: 'listener:error',
    LISTENER_RECOVERY_STARTED: 'listener:recovery_started',
    LISTENER_RECOVERY_COMPLETED: 'listener:recovery_completed',

    // ======================
    // RATE LIMITING
    // ======================
    RATE_LIMIT_HIT: 'rate_limit:hit',
    RATE_LIMIT_RESET: 'rate_limit:reset',
    RATE_LIMIT_CONFIG_CHANGED: 'rate_limit:config_changed',

    // ======================
    // METRICS & STATS
    // ======================
    METRICS_SNAPSHOT: 'metrics:snapshot',       // Full system metrics
    STATS_UPDATED: 'stats:updated',             // Key stats changed
    EVENT_TIMINGS_UPDATED: 'stats:event_timings', // Event latency metrics
    CONSECUTIVE_ERRORS_UPDATED: 'stats:consecutive_errors',

    // ======================
    // PAYLOAD EVENTS
    // ======================
    PAYLOAD_INVALID: 'payload:invalid',
    PAYLOAD_TRANSFORMED: 'payload:transformed',
    PAYLOAD_DROPPED: 'payload:dropped',
    PAYLOAD_RETRIED: 'payload:retried'
};
