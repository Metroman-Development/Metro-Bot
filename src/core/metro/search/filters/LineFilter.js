module.exports = class LineFilter {
    apply(matches, { lineFilter = null }) {
        
        console.log(`[LINE FILTER] Matches: ${matches}, LineFilter: ${lineFilter} `);
        
        if (!lineFilter) return matches;
        
        console.log(lineFilter);
        
        return matches.filter(match => 
            match?.line === lineFilter
        );
    }
};