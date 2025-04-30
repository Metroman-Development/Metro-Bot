class InteractionStore {
    constructor() {
        this.store = new Map();
        this.cleanupInterval = setInterval(() => this.clearExpired(), 3600000);
    }

    set(key, data, ttl = 300000) {
        const expiration = Date.now() + ttl;
        this.store.set(key, { data, expiration });
        return key;
    }

    get(key) {
        const item = this.store.get(key);
        if (!item) return null;
        
        if (Date.now() > item.expiration) {
            this.store.delete(key);
            return null;
        }
        
        return item.data;
    }

    delete(key) {
        this.store.delete(key);
    }

    clearExpired() {
        const now = Date.now();
        for (const [key, { expiration }] of this.store) {
            if (now > expiration) this.store.delete(key);
        }
    }

    destroy() {
        clearInterval(this.cleanupInterval);
    }
}

module.exports = new InteractionStore();