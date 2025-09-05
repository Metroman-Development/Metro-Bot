class CommerceFilter {
    constructor() {
        this.normalizeString = (str) => {
            return str
                .toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]/g, '');
        };
    }

    apply(stations, query) {
        if (!query) {
            return stations;
        }

        const normalizedQuery = this.normalizeString(query);

        return stations.filter(station => {
            if (!station.commerce || station.commerce === 'None') {
                return false;
            }

            const commerceItems = station.commerce.split(',')
                .map(item => item.trim())
                .filter(item => item);

            return commerceItems.some(item =>
                this.normalizeString(item).includes(normalizedQuery)
            );
        });
    }
}

module.exports = CommerceFilter;
