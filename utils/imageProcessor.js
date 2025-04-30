// utils/imageProcessor.js
// utils/imageProcessor.js
const sharp = require('sharp');
const axios = require('axios');
const { PDFDocument } = require('pdf-lib');
const { AttachmentBuilder } = require('discord.js');

class ImageProcessor {
    static async processForDiscord(source, options = {}) {
        try {
            const buffer = await this._getImageBuffer(source, options);
            if (!buffer) return null;

            const processed = await this._processWithSharp(buffer, options);
            return this._createAttachment(processed, options);
        } catch (error) {
            console.error('Image processing failed:', error);
            return null;
        }
    }

    static async processStationSchematic(stationName, options = {}) {
        // Try PDF first
        const pdfResult = await this._tryProcessPdf(stationName, options);
        if (pdfResult.success) return pdfResult.attachment;

        // Fallback to line image
        return this._getLineFallbackImage(stationName, options);
    }

    static async _tryProcessPdf(stationName, options) {
        try {
            const pdfUrl = this._getStationPdfUrl(stationName);
            const response = await axios.get(pdfUrl, {
                responseType: 'arraybuffer',
                timeout: 8000,
                validateStatus: (status) => status === 200
            });

            const pdfDoc = await PDFDocument.load(response.data);
            if (pdfDoc.getPages().length === 0) {
                throw new Error('PDF has no pages');
            }

            const imageBuffer = await this._renderPdfToImage(pdfDoc);
            const processedBuffer = await sharp(imageBuffer)
                .flatten({ background: '#ffffff' })
                .resize(options.resize?.width || 800, options.resize?.height || 600, {
                    fit: 'contain',
                    background: '#ffffff'
                })
                .toBuffer();

            return {
                success: true,
                attachment: new AttachmentBuilder(processedBuffer, {
                    name: options.filename || `${stationName.replace(/\s+/g, '_')}.png`,
                    description: options.description || 'Station schematic'
                })
            };
        } catch (error) {
            console.error(`PDF processing failed for ${stationName}:`, error.message);
            return { success: false };
        }
    }

    static async _renderPdfToImage(pdfDoc) {
        const tempDoc = await PDFDocument.create();
        const [page] = await tempDoc.copyPages(pdfDoc, [0]);
        tempDoc.addPage(page);
        
        const pdfBytes = await tempDoc.save();
        return await sharp(Buffer.from(pdfBytes))
            .flatten({ background: '#ffffff' })
            .toBuffer();
    }

    static async _getLineFallbackImage(stationName, options) {
        try {
            const line = this._extractLineCode(stationName);
    const lineImageUrl = `https://es.m.wikipedia.org/wiki/Archivo:Linea_5_Metro_de_Santiago_mapa.png`;
            
            const response = await axios.get(lineImageUrl, {
                responseType: 'arraybuffer',
                timeout: 5000
            });

            return new AttachmentBuilder(
                await sharp(response.data)
                    .flatten({ background: '#ffffff' })
                    .resize(options.resize?.width || 400, options.resize?.height || 300)
                    .toBuffer(),
                {
                    name: options.filename || `line_${line}.png`,
                    description: `Line ${line} fallback image`
                }
            );
        } catch (error) {
            console.error('Fallback image failed:', error.message);
            return null;
        }
    }

    static async _getImageBuffer(source, options) {
    try {
        if (Buffer.isBuffer(source)) {
            return options.isPdf 
                ? await this._pdfToBuffer(source, options.pageNumber) 
                : source;
        }

        if (typeof source === 'string' && source.startsWith('http')) {
            // Clean URL and detect SVG
            const cleanUrl = source.split('?')[0];
            const isSvg = cleanUrl.toLowerCase().endsWith('.svg');

            // Fetch with appropriate headers
            const response = await axios.get(cleanUrl, {
                responseType: 'arraybuffer',
                timeout: 5000,
                validateStatus: (status) => status === 200,
                headers: isSvg ? { 'Accept': 'image/svg+xml' } : {}
            });

            let buffer = Buffer.from(response.data);

            // Convert SVG to PNG if needed
            if (isSvg) {
                buffer = await sharp(buffer)
                    .flatten({ background: '#ffffff' })
                    .resize(options.resize?.width || 800, options.resize?.height || 600, {
                        fit: 'contain',
                        background: '#ffffff'
                    })
                    .png()
                    .toBuffer();
            }

            return buffer;
        }
        return null;
    } catch (error) {
        console.error('Buffer fetch failed:', error.message);
        return null;
    }
}

    static _extractLineCode(stationName) {
        const match = stationName.match(/(L\d+[a-z]?)$/i);
        return match ? match[0].toLowerCase() : '1';
    }

    static _getStationPdfUrl(stationName) {
        const formatted = stationName
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]/g, '');
        return `https://www.metro.cl/el-viaje/estaciones/isometricas/${formatted}.pdf`;
    }

    static async _processWithSharp(buffer, options) {
        const sharpInstance = sharp(buffer)
            .flatten({ background: options.backgroundColor || '#ffffff' });

        if (options.resize) {
            sharpInstance.resize(options.resize.width, options.resize.height, {
                fit: options.resize.fit || 'contain',
                background: options.resize.background || '#ffffff'
            });
        }

        return sharpInstance
            .toFormat(options.format || 'png')
            .toBuffer();
    }

    static _createAttachment(buffer, options) {
        return new AttachmentBuilder(buffer, {
            name: options.filename || 'image.png',
            description: options.description || 'Processed image'
        });
    }

    static async _pdfToBuffer(pdfBuffer, pageNumber = 0) {
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const pages = pdfDoc.getPages();
            return pages[pageNumber] ? await this._renderPdfToImage(pdfDoc) : null;
        } catch (error) {
            console.error('PDF conversion failed:', error.message);
            return null;
        }
    }
}

module.exports = ImageProcessor;