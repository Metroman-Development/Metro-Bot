// DataLoader.js
const lineLoader = require('../data/loaders/lineLoader');
const stationLoader = require('../data/loaders/stationLoader');
const metroLoader = require('../data/loaders/metroLoader');
const intermodalLoader = require('../data/loaders/intermodalLoader');
// const trainLoader = require('../data/loaders/trainLoader');
const EventRegistry = require('../../../core/EventRegistry');
const EventPayload = require('../../../core/EventPayload');
const EventTracer = require('../../../core/EventTracer');

class DataLoader {
  constructor(options = {}) {
    this.tracer = EventTracer;
    this.emitter = options.emitter || null;
    this._lastLoadDuration = 0;
  }

  async load() {
    const loadPayload = new EventPayload(
      EventRegistry.DATA_LOAD_STARTED,
      {
        subsystems: ['metro', 'lines', 'stations', 'intermodal', 'trains']
      },
      { source: 'DataLoader.load' }
    );
    const trace = this.tracer.track(loadPayload);
    trace.startTimer();

    try {
  
        console.log("[DataLoader] Loading Data") 
        
        const [system, lines, stations, intermodal] = await Promise.all([
        await this._loadWithTracking(metroLoader, 'metro'),
        this._loadWithTracking(lineLoader, 'lines'),
        this._loadWithTracking(stationLoader, 'stations'),
        this._loadWithTracking(intermodalLoader, 'intermodal'),
        // this._loadWithTracking(trainLoader, 'trains')
      ]);

     console.log("Successfully Loaded Data") 
        
        //console.log(system) 
        
     const result = {
        system,
        lines,
        stations,
        intermodal,
        trains: {},
        metadata: {
          version: Date.now(),
          loadDuration: this._lastLoadDuration,
          sources: {
            stations: stationLoader.source,
            lines: lineLoader.source,
            trains: 'disabled',
            intermodal: intermodalLoader.source
          }
        }
      };

      trace.endTimer();
      this._lastLoadDuration = trace.payload.processingTime;

      const successPayload = new EventPayload(
        EventRegistry.DATA_LOADED,
        {
          lineCount: Object.keys(lines).length,
          stationCount: Object.keys(stations).length,
          trainCount: 0,
          durationMs: this._lastLoadDuration
        },
        { source: 'DataLoader.load' }
      );
      this._emitEvent(EventRegistry.DATA_LOADED, successPayload);

      return result;
    } catch (error) {
      trace.endTimer();
      const errorPayload = new EventPayload(
        EventRegistry.DATA_ERROR,
        {
          error: error.message,
          stack: error.stack,
          failedAt: trace.payload.data.currentLoader,
          durationMs: trace.payload.processingTime
        },
        { source: 'DataLoader.load' }
      );
      this._emitEvent(EventRegistry.DATA_ERROR, errorPayload);
      throw new Error(`Data loading failed: ${error.message}`, { cause: error });
    }
  }

  async _loadWithTracking(loader, loaderName) {
    const loaderTrace = this.tracer.track(
      new EventPayload(
        EventRegistry.DATA_LOAD_PROGRESS,
        { currentLoader: loaderName },
        { source: 'DataLoader._loadWithTracking' }
      )
    );
    loaderTrace.startTimer();

    try {
      const data = await loader.load();
        
        console.log(loader.load());
        
      loaderTrace.endTimer();
      
      this._emitEvent(
        EventRegistry.DATA_LOAD_PROGRESS,
        new EventPayload(
          EventRegistry.DATA_LOAD_PROGRESS,
          {
            loader: loaderName,
            itemCount: Array.isArray(data) ? data.length : Object.keys(data).length,
            durationMs: loaderTrace.payload.processingTime
          },
          { source: 'DataLoader._loadWithTracking' }
        )
      );

      return data;
    } catch (error) {
      loaderTrace.endTimer();
      throw error;
    }
  }

  _emitEvent(eventType, payload) {
    if (this.emitter) {
      this.emitter.emit(eventType, payload);
    }
    this.tracer.track(payload);
  }
}

module.exports = DataLoader;
