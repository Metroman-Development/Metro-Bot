module.exports = class StatusFilter {
    apply(matches, { statusFilter = null }) {
        if (!statusFilter) return matches;
        return matches.filter(match => 
            match.status === statusFilter
        );
    }
};