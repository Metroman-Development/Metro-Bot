const ExactSearch = require('./strategies/ExactSearch');
const FuzzySearch = require('./strategies/FuzzySearch');
const LineFilter = require('./filters/LineFilter');
const StatusFilter = require('./filters/StatusFilter');
const CommerceFilter = require('./filters/CommerceFilter');
const BikeFilter = require('./filters/BikeFilter');
const { MetroInfoProvider } = require('../../../utils/MetroInfoProvider');
const DatabaseManager = require('../../database/DatabaseManager');
const logger = require('../../../events/logger');
const Normalizer = require('../utils/stringHandlers/normalization');
const SearchIndexer = require('./SearchIndexer');

class SearchCore {
  constructor(type = 'station', options = {}) {
    this.type = type;
    this.defaultThreshold = options.similarityThreshold || 0.6;
    this.phoneticWeight = options.phoneticWeight || 0.4;
    this.cache = new Map();
    this.dataSource = null;
    this.normalize = options?.normalize || Normalizer.normalize;
    this.cacheTTL = options.cacheTTL || 300000; // 5 minutes
    this.cacheTimers = new Map();
    this.disambiguationStyle = options.disambiguationStyle || 'auto';
    this.disambiguationTimeout = options.disambiguationTimeout || 120000;
    this.indexer = null;

    this.strategies = [
      new ExactSearch(),
      new FuzzySearch({
        phoneticWeight: this.phoneticWeight,
        minLength: 3
      })
    ];

    this.filters = {
      station: [new LineFilter(), new StatusFilter(), new CommerceFilter(), new BikeFilter()],
      line: [new StatusFilter()],
      train: [new StatusFilter(), new LineFilter()]
    };

    logger.debug(`[SEARCH] Initialized SearchCore for ${type}`);
  }

  setDataSource(data) {
    if (!data || (!data.stations && !data.lines)) {
        logger.warn('[SearchCore] setDataSource called with invalid data format.');
        return;
    }
    this.dataSource = {
        stations: data.stations || {},
        lines: data.lines || {}
    };
    this.indexer = new SearchIndexer(this.dataSource);
    this.indexer.buildIndex();
    logger.debug('[SearchCore] External data source has been set and indexed.');
  }

  async init() {
    // Data source is now set externally
  }

  async getById(id) {
  if (!this.dataSource) {
    await this.init();
  }

  const normalizedId = this.normalize(id);

  if (this.type === 'station' && this.dataSource.stations[normalizedId]) {
    return this._createMatchObject(this.dataSource.stations[normalizedId], 'exact');
  }

  if (this.type === 'line' && this.dataSource.lines[id]) {
    return this._createMatchObject(this.dataSource.lines[id], 'exact');
  }

  return null;
  }

  _normalizeStatus(status) {
    if (!status) return 'operational';
    if (typeof status === 'string') return status;
    if (status.code) return status.code === '1' ? 'operational' : 'closed';
    return 'operational';
  }

  async search(query, options = {}) {
  if (!query || typeof query !== 'string') {
    throw new Error('Invalid search query');
  }

  if (!this.dataSource) {
    throw new Error('Data source not loaded');
  }

  const cacheKey = this._getCacheKey(query, options);
  if (this.cache.has(cacheKey)) {
    logger.debug(`[SEARCH] Cache hit for "${query}"`);
    return this.cache.get(cacheKey);
  }

  try {
    // If needsOneMatch is true but no interaction provided, auto-return top match
    if (options.needsOneMatch && !options.interaction) {
      options.needsOneMatch = false;
      const results = await this._performSearch(query, options, cacheKey); // Pass cacheKey here
      return results.length > 0 ? [results[0]] : null;
    }

    return this._performSearch(query, options, cacheKey); // Pass cacheKey here
  } catch (error) {
    logger.error(`[SEARCH] Failed for "${query}":`, {
      error: error.message,
      stack: error.stack,
      query,
      options
    });
    throw new Error(`Search failed: ${error.message}`);
  }
}



    
  



async _performSearch(query, options, cacheKey) {
    const searchData = this.indexer.getIndex();
    const normalizedQuery = this.normalize(query.trim());

    if (this.type === 'station' && searchData.stations[normalizedQuery]) {
        const exactMatch = this._createMatchObject(searchData.stations[normalizedQuery], 'exact');
        this._setCache(cacheKey, [exactMatch]);
        return [exactMatch];
    }

    if (this.type === 'station') {
        const aliasMatch = this._findExactAliasMatch(normalizedQuery, searchData.stations);
        if (aliasMatch) {
            this._setCache(cacheKey, [aliasMatch]);
            return [aliasMatch];
        }
    }

    const searchTarget = this.type === 'station'
        ? Object.values(searchData.stations)
        : Object.values(searchData.lines);

    const exactNameMatch = this._findExactNameMatch(normalizedQuery, searchTarget);
    if (exactNameMatch) {
        this._setCache(cacheKey, [exactNameMatch]);
        return [exactNameMatch];
    }

    const strategyResults = await Promise.all(
        this.strategies.map(strategy =>
            strategy.execute(normalizedQuery, searchTarget, {
                ...options,
                normalize: this.normalize
            })
        )
    );

    const matches = strategyResults.flat().filter(match => match !== null);
    const filteredMatches = this._applyFilters(matches, options);
    const dedupedMatches = this._deduplicate(filteredMatches);

    const result = await this._resolveOutput(dedupedMatches, {
        needsOneMatch: options.needsOneMatch,
        interaction: options.interaction,
        query: normalizedQuery,
        maxResults: options.maxResults || 10,
        disambiguationStyle: this.disambiguationStyle,
        timeout: this.disambiguationTimeout
    });

    this._setCache(cacheKey, result);
    return result;
}

  _findExactAliasMatch(query, stations) {
    for (const [id, station] of Object.entries(stations)) {
      if (station.aliases?.some(alias => this.normalize(alias) === query)) {
        return this._createMatchObject(station, 'exact-alias');
      }
    }
    return null;
  }

  _findExactNameMatch(query, items) {
    const exactMatch = items.find(item => 
      this.normalize(item.name) === query || 
      this.normalize(item.displayName) === query
    );
    return exactMatch ? this._createMatchObject(exactMatch, 'exact-name') : null;
  }

  _createMatchObject(item, matchType) {
    if (!item) {
      logger.warn('Attempted to create match from undefined item');
      return null;
    }

    return {
      id: item.id || 'unknown',
      name: item.original || item.name || item.displayName || 'Unknown',
      displayName: item.displayName || item.original || item.name || 'Unknown',
      line: item.line_id ? item.line_id.toLowerCase() : (item.id ? item.id.toLowerCase() : 'unknown'),
      status: item.status?.code || 'operational',
      score: 1.0,
      matchType,
      phoneticMatch: false,
      metadata: {
        aliases: item.aliases || [],
        commune: item.commune || 'Unknown',
        accessibility: item.accessibility || {},
        amenities: item.amenities || []
      }
    };
  }

  _applyFilters(matches, filters) {
    const activeFilters = this.filters[this.type] || [];
    return activeFilters.reduce((results, filter) => {
      if (filter instanceof StatusFilter) {
        const statusFilter = filters.statusFilter || 'operational';
        return results.filter(item => item.status === statusFilter);
      }
      if (filter instanceof LineFilter && filters.lineFilter) {
        const lineFilter = filters.lineFilter.toLowerCase();
        return results.filter(item => item.line && item.line.toLowerCase() === lineFilter);
      }
      if (filter instanceof CommerceFilter && filters.commerceFilter) {
        return filter.apply(results, filters.commerceFilter);
      }
      if (filter instanceof BikeFilter && filters.bikeFilter) {
        return filter.apply(results, filters.bikeFilter);
      }
      return results;
    }, matches);
  }

  _deduplicate(matches) {
    const uniqueMatches = new Map();
    matches.forEach(match => {
        if (!match) return;
        const key = this.type === 'station' ? `${match.id}|${match.line}` : match.id;
        if (!uniqueMatches.has(key) || uniqueMatches.get(key).score < match.score) {
            uniqueMatches.set(key, match);
        }
    });
    return Array.from(uniqueMatches.values());
}

  async _resolveOutput(matches, options) {
    if (matches.length === 0) {
      return options.needsOneMatch ? null : [];
    }

    // If we need one match and there are multiple matches with the same top score,
    // we need to disambiguate.
    if (options.needsOneMatch && matches.length > 1 && matches[0].score === matches[1].score) {
        // continue to disambiguation
    } else if (options.needsOneMatch || !options.interaction) {
      return [matches[0]];
    }

    if (options.disambiguationStyle && !options.interaction) {
      logger.warn(`Disambiguation requested without interaction for query: ${options.query}`);
    }

    return new Promise((resolve, reject) => {
      if (!DisambiguationHandler?.create) {
        logger.warn('[SEARCH] DisambiguationHandler not available, returning first match');
        return resolve([matches[0]]);
      }

      DisambiguationHandler.create(
        options.interaction,
        options.query,
        matches,
        resolve,
        { 
          maxResults: options.maxResults,
          useButtons: this._shouldUseButtons(matches, options.disambiguationStyle),
          timeout: options.timeout
        }
      ).catch(reject);
    });
  }

  _shouldUseButtons(matches, style) {
    if (style === 'buttons') return true;
    if (style === 'select') return false;
    return matches.length <= 5;
  }

  _getCacheKey(query, options = {}) {
    const lineFilter = options.lineFilter || 'all';
    const statusFilter = options.statusFilter || 'any';
    const normalizedQuery = this.normalize(query);
    return `${this.type}_${normalizedQuery}_${lineFilter}_${statusFilter}`;
  }

  _setCache(key, value) {
    this.cache.set(key, value);
    
    if (this.cacheTimers.has(key)) {
      clearTimeout(this.cacheTimers.get(key));
    }
    
    this.cacheTimers.set(key, setTimeout(() => {
      this.cache.delete(key);
      this.cacheTimers.delete(key);
    }, this.cacheTTL));
  }

  clearCache() {
    logger.debug('[SEARCH] Clearing entire cache');
    this.cache.clear();
    this.cacheTimers.forEach(timer => clearTimeout(timer));
    this.cacheTimers.clear();
  }
}

module.exports = SearchCore;


