module.exports = {
    combineScores: (matches) => {
        return matches.reduce((acc, match) => {
            const existing = acc.find(m => m.id === match.id);
            if (existing) {
                existing.score = Math.max(existing.score, match.score);
            } else {
                acc.push(match);
            }
            return acc;
        }, []);
    }
};