/*
const { performance } = require('perf_hooks');
const metro = require('../modules/metro'); // Main metro system
const logger = require('../events/logger');
const { createDisambiguationEmbed } = require('../config/defaultEmbeds/disambiguationEmbed');

async function deepSearch(stationQuery, options = {}) {
    const startTime = performance.now();
    const { maxResults = 5, needsOneMatch = false, interaction = null } = options;

    // 1. Parse query using metro.strings utilities
    const { cleanQuery, lineFilter } = metro.strings.stations.parseStationQuery(stationQuery);

    // 2. Get all stations from MetroCore
    const allStations = await metro.core.getAllStations({
        includeNormalized: true,
        includePhonetic: true
    });

    // 3. Metro-optimized search pipeline
    const matches = [
        ...metroSearchExact(cleanQuery, allStations),
        ...metroSearchPartial(cleanQuery, allStations),
        ...metroSearchSimilar(cleanQuery, allStations, 0.65)
    ].filter(match => !lineFilter || match.line === lineFilter);

    // 4. Deduplicate using Metro's station ID system
    const uniqueMatches = Array.from(new Map(
        matches.map(match => [metro.strings.stations.generateStationId(match.name, match.line), match])
    ).values());

    logger.debug(`Metro deepSearch completed in ${(performance.now() - startTime).toFixed(2)}ms`);

    // 5. Handle disambiguation using Metro's UI system
    if (needsOneMatch && uniqueMatches.length > 1 && interaction) {
        return handleMetroDisambiguation(interaction, cleanQuery, uniqueMatches);
    }

    return needsOneMatch ? uniqueMatches[0] : uniqueMatches.slice(0, maxResults);
}

// Metro-integrated search functions
function metroSearchExact(query, stations) {
    const normalizedQuery = metro.strings.normalize(query);
    return stations.filter(s =>
        s.normalized === normalizedQuery
    ).map(s => ({ ...s, score: 1.0 }));
}

function metroSearchPartial(query, stations) {
    const normalizedQuery = metro.strings.normalize(query);
    return stations.filter(s =>
        s.normalized.includes(normalizedQuery) ||
        normalizedQuery.includes(s.normalized)
    ).map(s => ({
        ...s,
        score: Math.min(0.9, stringSimilarity.compareTwoStrings(normalizedQuery, s.normalized))
    }));
}

function metroSearchSimilar(query, stations, threshold) {
    const normalizedQuery = metro.strings.normalize(query);
    return stations.map(s => {
        const similarity = stringSimilarity.compareTwoStrings(normalizedQuery, s.normalized);
        return { ...s, score: similarity };
    }).filter(m => m.score >= threshold)
      .sort((a,b) => b.score - a.score);
}

// Metro-style disambiguation handler
async function handleMetroDisambiguation(interaction, query, matches) {
    return new Promise((resolve) => {
        const userId = interaction.user.id;
        const embedId = `${userId}_${interaction.id}`;

        metro.core.cache.set(`disambig:${embedId}`, {
            matches,
            resolve,
            query
        }, { ttl: 300 });

        const { embed, components } = metro.ui.createDisambiguationEmbed(
            query,
            matches,
            interaction.user.locale
        );

        interaction.editReply({
            embeds: [embed],
            components: [components]
        });
    });
}

module.exports = {
    deepSearch,
    metroSearchExact,
    metroSearchPartial,
    metroSearchSimilar
};*/
