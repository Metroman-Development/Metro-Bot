const EventEmitter = require('events');
const logger = require('../../../events/logger');
const { getClient } = require('../../../utils/clientManager');
const metroConfig = require('../../../config/metro/metroConfig');

// Components
const UpdateListener = require('./UpdateListener');
const EmbedManager = require('./EmbedManager');
const UpdateProcessor = require('./UpdateProcessor');
const AnnouncementHandler = require('./AnnouncementHandler');

// Complete UI Strings
const UI_STRINGS = {
    SYSTEM: {
        INITIALIZING: "🚇 Inicializando sistema de actualización de estado...",
        READY: "✅ Sistema de actualización de estado listo",
        ERROR: {
            INIT_FAILED: "❌ Error al inicializar el sistema de actualización",
            CHANNEL_FETCH: "❌ Error al obtener canal de Discord",
            MESSAGE_FETCH: "❌ Error al obtener mensajes embebidos",
            UPDATE_FAILED: "❌ Error en actualización de estado",
            PROCESSING_FAILED: "❌ Error al procesar cambios"
        }
    },
    UPDATES: {
        STARTED: "🔄 Iniciando actualización de estado",
        COMPLETED: "✅ Actualización de estado completada",
        FAILED: "❌ Error en actualización de estado",
        QUEUED: "⏳ Actualización en cola (embebidos no listos)",
        PROCESSING: "🔧 Procesando {count} actualizaciones pendientes",
        BATCH_START: "🔄 Procesando actualizaciones agrupadas...",
        BATCH_COMPLETE: "✅ Actualizaciones agrupadas completadas"
    },
    EMBEDS: {
        CACHING: "📥 Almacenando en caché mensajes embebidos...",
        CACHED: "✅ Mensaje embebido almacenado: {name}",
        CACHE_FAILED: "❌ Error al almacenar mensaje embebido: {name}",
        UPDATING: "🔄 Actualizando embebidos...",
        UPDATED: "✅ Embebidos actualizados exitosamente",
        LINE_UPDATE: "🔄 Actualizando línea {line}",
        OVERVIEW_UPDATE: "🔄 Actualizando vista general",
        UPDATE_FAILED: "❌ Error al actualizar {type}"
    },
    ANNOUNCEMENTS: {
        EXPRESS_START: "🚄 SERVICIO EXPRESO INICIADO",
        EXPRESS_END: "🚄 SERVICIO EXPRESO FINALIZADO",
        SERVICE_OPEN: "🚇 SERVICIO INICIADO",
        SERVICE_CLOSE: "🚇 SERVICIO FINALIZADO",
        EVENT_START: "🎉 EVENTO ESPECIAL INICIADO",
        EVENT_END: "🎉 EVENTO ESPECIAL FINALIZADO",
        TITLES: {
            EXPRESS: "Actualización de Servicio Expreso",
            SERVICE: "Cambio en Horario de Servicio",
            EVENT: "Notificación de Evento Especial"
        },
        DESCRIPTIONS: {
            EXPRESS_START: "El servicio expreso ha comenzado en las siguientes líneas:",
            EXPRESS_END: "El servicio expreso ha concluido en las siguientes líneas:",
            SERVICE_OPEN: "El servicio regular ha comenzado para el horario {dayType}",
            SERVICE_CLOSE: "El servicio regular ha concluido para el horario {dayType}",
            EVENT_START: "Un evento especial está afectando el servicio:",
            EVENT_END: "Un evento especial ha concluido:"
        }
    },
    STATUS: {
        OPERATIONAL: "🟢 Operacional",
        DELAYED: "🟡 Retrasado",
        SUSPENDED: "🔴 Suspendido",
        LIMITED: "🟠 Servicio limitado",
        UNKNOWN: "⚫ Estado desconocido"
    },
    TIME: {
        NOW: "Ahora",
        MINUTES_AGO: "Hace {n} minutos",
        HOURS_AGO: "Hace {n} horas",
        UNKNOWN: "Desconocido",
        FORMAT_LONG: "DD/MM/YYYY HH:mm",
        FORMAT_SHORT: "HH:mm"
    },
    MISC: {
        LINE: "Línea",
        STATION: "Estación",
        ALL_LINES: "Todas las líneas",
        NO_CHANGES: "Sin cambios recientes",
        PASSENGERS: "Pasajeros afectados",
        NEXT_UPDATE: "Próxima actualización"
    }
};

class StatusUpdater extends EventEmitter {
    constructor(metroCore, changeDetector) {
        super();
        
        // Validate dependencies
        const client = getClient();
        if (!client || !metroCore) {
            const error = new Error(UI_STRINGS.SYSTEM.ERROR.INIT_FAILED);
            logger.fatal('[StatusUpdater] Initialization failed - missing core dependencies', {
                hasClient: !!client,
                hasMetroCore: !!metroCore
            });
            throw error;
        }

        // Core properties
        this.client = client;
        this.metroCore = metroCore;
        this.changeDetector = changeDetector || metroCore._subsystems.changeDetector;
        this.queue = new (require('./StatusUpdateQueue'))();
        this.UI_STRINGS = UI_STRINGS;
        this.debugMode = false;

        // Initialize components
        this.listener = new UpdateListener(this);
        this.embeds = new EmbedManager(this, this.metroCore);
        this.processor = new UpdateProcessor(this);
        this.announcer = new AnnouncementHandler(this);
        
        this.changeHistory = [] 

        // Setup listeners
        this.listener.setupEventListeners();
    }
    
    async triggerInitialUpdate() {
        this.metroCore = await this.metroCore;
        const metroInfoProvider = this.metroCore._subsystems.metroInfoProvider;

        if (!metroInfoProvider) {
            logger.error('[StatusUpdater] MetroInfoProvider not available. Skipping initial embed update.');
            return;
        }

        const initialData = metroInfoProvider.getFullData();
        if (initialData && Object.keys(initialData.lines).length > 0) {
            logger.info('[StatusUpdater] Triggering initial embed update with full data.');
            await this.updateAllEmbeds(initialData);
        } else {
            logger.warn('[StatusUpdater] No data available for initial embed update.');
        }
       } 

    async initialize() {
        try {
            logger.system('[StatusUpdater] Starting initialization sequence');
            this.emit('status', this.UI_STRINGS.SYSTEM.INITIALIZING);
            
            await this.announcer.initialize();
            await this.embeds.cacheEmbedMessages();
            this.processor.processPendingUpdates();
            
            this.emit('status', this.UI_STRINGS.SYSTEM.READY);
            logger.system('[StatusUpdater] Initialization completed successfully');
            this.emit('ready');
        } catch (error) {
            logger.fatal('[StatusUpdater] Initialization failed', {
                error: error.message,
                stack: error.stack
            });
            this.emit('initializationFailed', error);
            throw error;
        }
    }

    enableDebugMode() {
        logger.system('[StatusUpdater] Enabling debug mode');
        this.debugMode = true;
        this.queue.enableDebugMode();
        if (this.changeDetector) this.changeDetector.enableDebugMode();
        if (this.announcer) this.announcer.enableDebugMode();
        return this;
    }

    // Proxy methods to components
    async cacheEmbedMessages() { return this.embeds.cacheEmbedMessages(); }
    async updateEmbeds(data) { return this.embeds.updateAllEmbeds(data); }
    async handleDataUpdate(data) { return this.processor.handleDataUpdate(data); }
    async handleInitialState(data) { return this.processor.handleInitialState(data); }
    async processChanges(changes) { return this.processor.processChanges(changes); }
    async processPendingUpdates() { return this.processor.processPendingUpdates(); }
    async processQueuedUpdates() { return this.processor.processQueuedUpdates(); }
    async queueUpdate(type, data) { return this.processor.queueUpdate(type, data); }
    async forceUpdate(options) { return this.processor.forceUpdate(options); }
    async updateAllEmbeds(data, changes) { return this.embeds.updateAllEmbeds(data, changes); }
    async updateOverviewEmbed(data, changes) { return this.embeds.updateOverviewEmbed(data, changes); }
    async updateLineEmbed(lineData) { return this.embeds.updateLineEmbed(lineData); }
    async updateAllLineEmbeds(data) { return this.embeds.updateAllLineEmbeds(data); }
    findPendingUpdateOfType(type) { return this.processor.findPendingUpdateOfType(type); }
    logPendingUpdates() { return this.processor.logPendingUpdates(); }
}

module.exports = StatusUpdater;








