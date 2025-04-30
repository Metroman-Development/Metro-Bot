// modules/metro/core/services/NewsService.js
// modules/metro/core/services/NewsService.js
const fs = require('fs').promises;
const path = require('path');
const { getClient } = require('../../../../utils/clientManager');
const logger = require('../../../../events/logger');

class NewsService {
    constructor(metro) {
        this.metro = metro;
        this.newsDir = path.join(__dirname, '../../news/');
        this.channelId = '899842767096791060'; // Hardcoded channel ID
        this._processedFiles = new Set();
        this._discordClient = getClient();
        this._lastPosted = null;
        this._postedCount = 0;
        
        // Ensure news directory exists
        this._ensureNewsDir().catch(error => {
            logger.error('[NewsService] Failed to initialize news directory:', error);
        });
    }

    async _ensureNewsDir() {
        try {
            await fs.mkdir(this.newsDir, { recursive: true });
        } catch (error) {
            logger.error('[NewsService] News directory creation failed:', error);
            throw error;
        }
    }

    async checkNews(force = false) {
        if (!this._discordClient?.isReady()) {
            logger.debug('[NewsService] Discord client not ready, skipping news check');
            return { posted: 0 };
        }

        try {
            const files = await fs.readdir(this.newsDir);
            const jsonFiles = files.filter(file => file.endsWith('.json'));
            let postedCount = 0;

            for (const file of jsonFiles) {
                const filePath = path.join(this.newsDir, file);
                
                try {
                    if (await this._shouldProcessFile(filePath, file, force)) {
                        const result = await this._processNewsFile(filePath, file);
                        if (result) postedCount++;
                    }
                } catch (error) {
                    logger.error(`[NewsService] Error processing file ${file}:`, error);
                }
            }

            return { posted: postedCount };
        } catch (error) {
            logger.error('[NewsService] News check failed:', error);
            return { posted: 0, error: error.message };
        }
    }

    async _shouldProcessFile(filePath, filename, force) {
        if (this._processedFiles.has(filename) && !force) return false;
        
        try {
            const stats = await fs.stat(filePath);
            // Process if forced or file is new (modified in last minute)
            return force || (Date.now() - stats.mtimeMs < 60000);
        } catch (error) {
            logger.error(`[NewsService] Error checking file ${filename}:`, error);
            return false;
        }
    }

    async _processNewsFile(filePath, filename) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            const newsEmbed = this._parseNewsFile(data, filename);

            const channel = await this._discordClient.channels.fetch(this.channelId);
            if (!channel) {
                logger.error(`[NewsService] Channel ${this.channelId} not found`);
                return false;
            }

            await channel.send({ embeds: [newsEmbed] });
            this._processedFiles.add(filename);
            this._lastPosted = new Date();
            this._postedCount++;
            
            logger.info(`[NewsService] Posted news from ${filename}`);
            return true;
        } catch (error) {
            logger.error(`[NewsService] Failed to process ${filename}:`, error);
            throw error;
        }
    }

    _parseNewsFile(data, filename) {
        try {
            const newsData = JSON.parse(data);
            
            // Required fields with defaults
            const embed = {
                title: newsData.title || 'Novedad del Metro',
                description: newsData.description || 'Nueva actualización disponible',
                color: newsData.color || 0x0099ff,
                timestamp: newsData.timestamp || new Date().toISOString(),
                footer: newsData.footer || {
                    text: 'Sistema de noticias del Metro'
                }
            };

            // Optional fields
            if (newsData.author) embed.author = newsData.author;
            if (newsData.image) embed.image = { url: newsData.image };
            if (newsData.thumbnail) embed.thumbnail = { url: newsData.thumbnail };
            if (newsData.fields) {
                embed.fields = newsData.fields.map(field => ({
                    name: field.name || 'Campo',
                    value: field.value || 'Valor',
                    inline: field.inline || false
                }));
            }

            return embed;
        } catch (error) {
            logger.error(`[NewsService] Invalid news format in ${filename}`);
            // Fallback embed when parsing fails
            return {
                title: 'Novedad del Metro',
                description: `Nueva actualización disponible (${filename})`,
                color: 0xff0000,
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'Error procesando el formato de noticias'
                }
            };
        }
    }

    async injectNews(newsData) {
        try {
            const filename = `injected_${Date.now()}.json`;
            const filePath = path.join(this.newsDir, filename);
            await fs.writeFile(filePath, JSON.stringify(newsData, null, 2));
            return await this._processNewsFile(filePath, filename);
        } catch (error) {
            logger.error('[NewsService] News injection failed:', error);
            throw error;
        }
    }

    clearCache() {
        this._processedFiles.clear();
        logger.debug('[NewsService] Cleared processed files cache');
        return { success: true, cleared: this._processedFiles.size };
    }

    getLastPosted() {
        return this._lastPosted ? this._lastPosted.toISOString() : null;
    }

    getPostedCount() {
        return this._postedCount;
    }

    getStatus() {
        return {
            ready: this._discordClient?.isReady() || false,
            channelId: this.channelId,
            lastPosted: this.getLastPosted(),
            totalPosted: this._postedCount,
            pendingFiles: this._processedFiles.size
        };
    }

    cleanup() {
        this._processedFiles.clear();
        this._lastPosted = null;
        this._postedCount = 0;
    }
}

module.exports = NewsService;