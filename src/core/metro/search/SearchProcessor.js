const SearchHelper = require('./SearchHelper.js');
const { DisambiguationHandler } = require('disambiguate/DisambiguationHandler.js');
const logger = require('../../../events/logger.js');
const { EmbedBuilder } = require('discord.js');
const { 
  normalize: normalizeText,
  sanitize 
} = require('../utils/stringHandlers/normalization');
const {
  normalizeKey,
  formatDisplay
} = require('../utils/stringHandlers/lineProcessing');
const {
  formatName,
  removeLineSuffix,
  generateId
} = require('../utils/stringHandlers/stationFormatting');
const {
  decorateStation,
  decorateLine
} = require('../utils/stringHandlers/decorators');
const {
  isValidLine,
  isTransferStation
} = require('../utils/stringHandlers/validators');

class SearchProcessor {
  constructor(metroCore) {
    if (!metroCore) throw new Error('MetroCore instance required');
    this.metroCore = metroCore;
    this.helper = new SearchHelper(metroCore);

    // Field configuration with weights and search methods
    this.fieldConfig = {
      stations: this._getStationFieldConfig(),
      lines: this._getLineFieldConfig(),
      trains: this._getTrainFieldConfig()
    };
  }

  _getStationFieldConfig() {
    return {
      id: { weight: 1.0, searchFn: this._searchExactMatch },
      name: { weight: 0.9, searchFn: this._searchFuzzyMatch },
      displayName: { weight: 0.95, searchFn: this._searchFuzzyMatch },
      code: { weight: 0.8, searchFn: this._searchExactMatch },
      line: { 
        weight: 0.7, 
        searchFn: (query, value) => this._searchLineReference(query, value) 
      },
      commune: { weight: 0.6, searchFn: this._searchFuzzyMatch },
      amenities: { 
        weight: 0.5, 
        searchFn: (query, value) => this._searchArrayField(query, value) 
      },
      accessibility: { 
        weight: 0.5,
        searchFn: (query, value) => this._searchAccessibility(query, value) 
      },
      combination: { weight: 0.4, searchFn: this._searchExactMatch },
      connections: { 
        weight: 0.4,
        searchFn: (query, value) => this._searchConnections(query, value) 
      },
      services: { weight: 0.3, searchFn: this._searchFuzzyMatch },
      transports: { weight: 0.3, searchFn: this._searchFuzzyMatch },
      commerce: { weight: 0.2, searchFn: this._searchFuzzyMatch },
      aliases: { 
        weight: 0.85,
        searchFn: (query, value) => this._searchAliases(query, value) 
      }
    };
  }

  _getLineFieldConfig() {
    return {
      id: { weight: 1.0, searchFn: this._searchExactMatch },
      displayName: { weight: 0.9, searchFn: this._searchFuzzyMatch },
      color: { weight: 0.1, searchFn: this._searchExactMatch },
      status: { weight: 0.3, searchFn: this._searchExactMatch },
      fleet: { 
        weight: 0.4,
        searchFn: (query, value) => this._searchTrainFleet(query, value) 
      },
      details: { 
        weight: 0.2,
        searchFn: (query, value) => this._searchLineDetails(query, value) 
      },
      infrastructure: { 
        weight: 0.2,
        searchFn: (query, value) => this._searchInfrastructure(query, value) 
      },
      stations: { 
        weight: 0.5,
        searchFn: (query, value) => this._searchStationReferences(query, value) 
      }
    };
  }

  _getTrainFieldConfig() {
    return {
      id: { weight: 1.0, searchFn: this._searchExactMatch },
      line: { weight: 0.9, searchFn: this._searchLineReference },
      model: { weight: 0.8, searchFn: this._searchFuzzyMatch },
      serialNumber: { weight: 0.95, searchFn: this._searchExactMatch },
      manufacturer: { weight: 0.6, searchFn: this._searchFuzzyMatch },
      year: { weight: 0.4, searchFn: this._searchNumeric },
      capacity: { weight: 0.3, searchFn: this._searchNumeric },
      status: { weight: 0.7, searchFn: this._searchExactMatch },
      lastMaintenance: { weight: 0.2, searchFn: this._searchDate },
      currentLocation: { weight: 0.5, searchFn: this._searchFuzzyMatch }
    };
  }

  async search(query, options = {}) {
    const { 
      searchIn = 'auto', 
      interaction, 
      maxResults = 5,
      ephemeral = true,
      autoDisambiguate = true
    } = options;
    
    try {
      // Sanitize and normalize query
      const cleanQuery = sanitize(query);
      const normalizedQuery = normalizeText(cleanQuery.trim());

      // Determine search types and fields
      const { types, fields } = this._determineSearchScope(normalizedQuery, searchIn);
      logger.debug(`Searching for "${normalizedQuery}" in types: ${types.join(', ')}`);

      // Execute comprehensive search
      const results = await this._searchAcrossAllFields(normalizedQuery, types, fields);

      // Process and decorate results
      const processedResults = this._processResults(results, normalizedQuery);

      // Handle disambiguation if needed
      return this._handleDisambiguation(
        interaction,
        cleanQuery,
        processedResults,
        { maxResults, ephemeral, autoDisambiguate }
      );
    } catch (error) {
      logger.error('Search failed:', error);
      throw this._createErrorResponse(error, query);
    }
  }

  _determineSearchScope(query, searchIn) {
    if (searchIn !== 'auto') {
      const types = Array.isArray(searchIn) ? searchIn : [searchIn];
      return {
        types,
        fields: this._getFieldsForTypes(types)
      };
    }

    // Auto-detection logic
    const types = [];
    const fields = new Set();

    // Check for line references
    if (this._looksLikeLineReference(query)) {
      types.push('lines');
      fields.add('id');
      fields.add('displayName');
    }

    // Check for train references
    if (this._looksLikeTrainReference(query)) {
      types.push('trains');
      fields.add('id');
      fields.add('serialNumber');
    }

    // Always include stations with all relevant fields
    types.push('stations');
    this._getFieldsForTypes(['stations']).forEach(f => fields.add(f));

    return {
      types: types.length ? types : ['stations', 'lines', 'trains'],
      fields: fields.size ? Array.from(fields) : null // null = all fields
    };
  }

  async _searchAcrossAllFields(query, types, fields) {
    const data = this.metroCore.getCurrentData();
    const results = [];

    for (const type of types) {
      const items = data[type];
      if (!items) continue;

      const typeConfig = this.fieldConfig[type];
      const typeFields = fields || Object.keys(typeConfig);

      for (const [id, item] of Object.entries(items)) {
        let totalScore = 0;
        let bestMatch = null;
        let matchedFields = [];

        for (const field of typeFields) {
          const config = typeConfig[field];
          if (!config) continue;

          const value = item[field];
          if (value === undefined || value === null) continue;

          const { score, match } = await config.searchFn(query, value);
          if (score > 0) {
            const weightedScore = score * config.weight;
            if (weightedScore > totalScore) {
              totalScore = weightedScore;
              bestMatch = match;
            }
            matchedFields.push({
              field,
              score: weightedScore,
              match
            });
          }
        }

        if (totalScore > 0) {
          results.push({
            type,
            id,
            item,
            score: totalScore,
            bestMatch,
            matchedFields
          });
        }
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  // Field-specific search methods
  _searchExactMatch(query, value) {
    const normalizedValue = normalizeText(String(value));
    return {
      score: normalizedValue === query ? 1.0 : 0,
      match: { type: 'exact', value }
    };
  }

  _searchFuzzyMatch(query, value) {
    const normalizedValue = normalizeText(String(value));
    const contains = normalizedValue.includes(query) ? 0.8 : 0;
    const startsWith = normalizedValue.startsWith(query) ? 0.9 : 0;
    const exact = normalizedValue === query ? 1.0 : 0;
    const score = Math.max(contains, startsWith, exact);
    return {
      score,
      match: { type: score === 1.0 ? 'exact' : 'fuzzy', value }
    };
  }

  _searchArrayField(query, array) {
    if (!Array.isArray(array)) return { score: 0 };
    const bestMatch = array
      .map(item => this._searchFuzzyMatch(query, item))
      .sort((a, b) => b.score - a.score)[0];
    return bestMatch || { score: 0 };
  }

  _searchAliases(query, aliases) {
    if (!Array.isArray(aliases)) return { score: 0 };
    return this._searchArrayField(query, aliases);
  }

  _searchLineReference(query, lineCode) {
    const normalizedLine = normalizeKey(lineCode);
    const normalizedQuery = normalizeKey(query);
    return this._searchExactMatch(normalizedQuery, normalizedLine);
  }

  _searchAccessibility(query, accessibilityData) {
    if (!accessibilityData) return { score: 0 };
    return this._searchFuzzyMatch(query, accessibilityData.description || '');
  }

  // ... (other field-specific search methods)

  _processResults(results, query) {
    return results.map(result => {
      const decorated = this._decorateResult(result, query);
      return {
        ...result,
        ...decorated,
        display: this._createDisplayString(result, decorated)
      };
    });
  }

  _decorateResult(result, query) {
    switch (result.type) {
      case 'stations':
        return {
          name: formatName(result.item.name),
          line: decorateLine(result.item.line),
          status: result.item.status,
          isTransfer: isTransferStation(result.id, result.item.line)
        };
      case 'lines':
        return {
          name: formatDisplay(result.item.id),
          color: result.item.color,
          status: result.item.status
        };
      case 'trains':
        return {
          name: `${result.item.model} (${result.item.serialNumber})`,
          line: decorateLine(result.item.line),
          status: result.item.status
        };
      default:
        return {};
    }
  }

  _createDisplayString(result, decorated) {
    switch (result.type) {
      case 'stations':
        return decorateStation(decorated.name, {
          line: result.item.line,
          status: result.item.status,
          transfer: decorated.isTransfer
        });
      case 'lines':
        return `${decorated.name} ${decorateLine(result.item.id)}`;
      case 'trains':
        return `${decorated.name} on ${decorated.line}`;
      default:
        return result.id;
    }
  }

  _handleDisambiguation(interaction, query, results, options) {
    if (!options.autoDisambiguate || results.length <= 1 || options.maxResults !== 1) {
      return results.slice(0, options.maxResults);
    }

    return new Promise((resolve) => {
      DisambiguationHandler.create(
        interaction,
        query,
        results,
        resolve,
        options
      );
    });
  }

  _createErrorResponse(error, query) {
    return {
      error: true,
      message: `Failed to search for "${query}": ${error.message}`,
      details: error.stack
    };
  }

  // Utility detection methods
  _looksLikeLineReference(query) {
    return /^(l|linea?)\s*[0-9]+$/i.test(query) || 
           Object.values(this.metroCore.getCurrentData().lines || {})
             .some(line => normalizeText(line.displayName).includes(query));
  }

  _looksLikeTrainReference(query) {
    return /^(tr|tren)\s*\d+/i.test(query) || 
           /[A-Z]{2}\d{5}/.test(query);
  }
}

module.exports = SearchProcessor;