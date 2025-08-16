const { fetch } = require('undici');
const fsp = require('fs').promises;
const path = require('path');
const fs = require('fs');
const logger = require('../../../../events/logger');

class EstadoRedService {
    constructor(options = {}) {
        this.timeHelpers = options.timeHelpers;
        this.config = options.config;
        this.estadoRedUrl = this._getEstadoRedUrl();
        this.cacheFile = path.join(__dirname, '../../../../data/cache/network-status.json');
        this.legacyCacheFile = path.join(__dirname, '../../../../data/estadoRed.json');
    }

    async fetchStatus() {
        if (this.timeHelpers.isWithinOperatingHours()) {
            try {
                const rawData = await this._fetchWithRetry();
                await this._updateCache(rawData);
                return rawData;
            } catch (error) {
                logger.error('[EstadoRedService] Fetch failed, falling back to cache', { error });
                return this._readCachedData();
            }
        } else {
            const cachedData = await this._readCachedData();
            return this._generateClosedState(cachedData);
        }
    }

    async _fetchWithRetry() {
        let lastError;
        const { maxRetries, baseRetryDelay, maxRetryDelay, timeout } = this.config.api;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(this.estadoRedUrl);

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data = await response.json();
                this._validateApiResponse(data);
                return data;

            } catch (error) {
                lastError = error;

                if (attempt < maxRetries) {
                    const delay = this._calculateBackoff(attempt, baseRetryDelay, maxRetryDelay);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    }

    _calculateBackoff(attempt, baseDelay, maxDelay) {
        return Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    }

    _validateApiResponse(data) {
        logger.debug('[EstadoRedService] Validating response structure');
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid network-status-json format');
        }

        Object.keys(data.lineas || {}).forEach(line => {
            if (!line.startsWith('l')) {
                throw new Error(`Invalid line ID format: ${line}`);
            }
        });
    }

    async _updateCache(data) {
        try {
            await fsp.mkdir(path.dirname(this.cacheFile), { recursive: true });
            await fsp.writeFile(this.cacheFile, JSON.stringify(data, null, 2));
            logger.debug('[EstadoRedService] Cache updated successfully');
        } catch (error) {
            logger.error('[EstadoRedService] Cache update failed', { error });
            throw error;
        }
    }

    async _readCachedData() {
        try {
            try {
                const data = await fsp.readFile(this.cacheFile, 'utf8');
                return JSON.parse(data);
            } catch (newCacheError) {
                if (await this._fileExists(this.legacyCacheFile)) {
                    const legacyData = await fsp.readFile(this.legacyCacheFile, 'utf8');
                    const parsedData = JSON.parse(legacyData);
                    await this._updateCache(parsedData);
                    return parsedData;
                }
                throw newCacheError;
            }
        } catch (error) {
            logger.error('[EstadoRedService] Cache read failed', { error });
            throw error;
        }
    }

    async _fileExists(filePath) {
        try {
            await fsp.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    _generateClosedState(rawData = {}) {
        logger.debug('[EstadoRedService] Generating closed state for non-operating hours');

        const state = rawData;

        Object.keys(state).forEach(lineId => {
            if (['l1', 'l2', 'l3', 'l4', 'l4a', 'l5', 'l6'].includes(lineId)) {
                if (state[lineId].estado !== undefined) state[lineId].estado = "0";
                if (state[lineId].mensaje !== undefined) state[lineId].mensaje = "Cierre por horario";
                if (state[lineId].mensaje_app !== undefined) state[lineId].mensaje_app = "Cierre por horario";

                if (Array.isArray(state[lineId].estaciones)) {
                    state[lineId].estaciones.forEach(station => {
                        if (station.estado !== undefined) station.estado = "0";
                        if (station.descripcion !== undefined) station.descripcion = "Cierre por horario";
                        if (station.descripcion_app !== undefined) station.descripcion_app = "Cierre por horario";
                    });
                }
            }
        });

        return state;
    }

    _getEstadoRedUrl() {
        // First, try to get from process.env, which might be correctly set in some environments
        if (process.env.ESTADO_RED && process.env.ESTADO_RED.startsWith('http')) {
            return process.env.ESTADO_RED;
        }

        // If not, read the .env file manually
        try {
            const envPath = path.join(__dirname, '../../../../../.env');
            if (fs.existsSync(envPath)) {
                const envFileContent = fs.readFileSync(envPath, 'utf-8');
                const lines = envFileContent.split('\n');
                for (const line of lines) {
                    if (line.startsWith('ESTADO_RED')) {
                        const separatorIndex = line.search(/[:=]/);
                        if (separatorIndex !== -1) {
                            const url = line.substring(separatorIndex + 1).trim();
                            if (url.startsWith('http')) {
                                return url;
                            }
                        }
                    }
                }
            }
        } catch (e) {
            if (typeof logger !== 'undefined') {
                logger.error('[EstadoRedService] Error reading .env file for custom parsing', e);
            } else {
                console.error('[EstadoRedService] Error reading .env file for custom parsing', e);
            }
        }

        return 'https://www.metro.cl/api/estadoRedDetalle.php';
    }
}

module.exports = EstadoRedService;
