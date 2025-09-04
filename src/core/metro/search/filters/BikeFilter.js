class BikeFilter {
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
            const connections = station.connections;

            if (!connections || !connections.bikes || !Array.isArray(connections.bikes)) {
                return false;
            }

            return connections.bikes.some(service =>
                service && this.normalizeString(service).includes(normalizedQuery)
            );
        });
    }
}

module.exports = BikeFilter;
