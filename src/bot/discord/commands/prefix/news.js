const { EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const metroConfig = require('../../../../config/metro/metroConfig');

module.exports = {
    name: 'news',
    description: '📢 Metro news creation system with $keyword support',
    permissions: ['ADMINISTRATOR'],
    usage: '!news create',
    
    async execute(message, args) {
        const subcommand = args[0]?.toLowerCase();
        
        if (subcommand === 'create') {
            await this._createNewsWizard(message);
        } else {
            await message.reply('Use `!news create` to start creating a news announcement');
        }
    },

    async _createNewsWizard(message) {
        try {
            // Display available keywords at start
            await message.reply({
                content: `📢 **Available $keywords**:
- **Logos**: $metroLogo, $logoV4, $logoColors
- **Line Emojis**: $line1, $line2, $line3, $line4, $line4a, $line5, $line6, $line7, $line8, $line9
- **Status Emojis**: $statusOperational, $statusClosed, $statusPartial, $statusDelayed, $statusExtended
- **Access Cards**: $bip, $tne, $bipAM, $tam
- **Connection Emojis**: $bus, $train, $intermodal, $busterminal
- **Special Emojis**: $rendimiento, $equipamiento, $tecnico, $tren, $fabricante, $años`
            });

            // Step 1: Collect basic information
            const title = await this._askQuestion(message, 'Enter news title (max 256 chars, can use $keywords):');
            let description = await this._askQuestion(message, 'Enter detailed description (supports $keywords):');
            
            // Process $keywords in text fields
            description = this._processKeywords(description);
            
            // Step 2: Visual customization
            let color = await this._askQuestion(message, 
                'Enter embed color (hex without #) or type "default" for default blue (3498DB):',
                false
            );
            color = color.toLowerCase() === 'default' ? '3498DB' : color;
            
            // Step 3: Media attachments
            let thumbnail = await this._askQuestion(message, 
                'Enter thumbnail URL or $keyword (type "skip" to omit):\nExamples: $metroLogo, $logoV4, $logoColors',
                false
            );
            thumbnail = this._processKeywords(thumbnail);
            
            let image = await this._askQuestion(message, 
                'Enter main image URL or $keyword (type "skip" to omit):\nExamples: $metroLogo, $logoV4, $logoColors',
                false
            );
            image = this._processKeywords(image);
            
            // Step 4: Author information
            let authorName = await this._askQuestion(message, 
                'Enter author name or type "skip" to use your username:',
                false
            );
            
            let authorIcon = await this._askQuestion(message, 
                'Enter author icon URL or $keyword (type "skip" to omit):\nExamples: $line1, $bip, $tne',
                false
            );
            authorIcon = this._processKeywords(authorIcon);
            
            let authorUrl = await this._askQuestion(message, 
                'Enter author URL or type "skip" to omit:',
                false
            );
            
            // Step 5: Additional fields
            const fields = [];
            while (true) {
                const addField = await this._askQuestion(message, 
                    'Add a field? (yes/no)', 
                    false,
                    ['yes', 'no', 'y', 'n']
                );
                
                if (addField.toLowerCase() === 'no' || addField.toLowerCase() === 'n') break;
                
                let fieldName = await this._askQuestion(message, 'Field name:');
                fieldName = this._processKeywords(fieldName);
                
                let fieldValue = await this._askQuestion(message, 'Field value:');
                fieldValue = this._processKeywords(fieldValue);
                
                const inline = await this._askQuestion(message, 
                    'Display inline? (yes/no)',
                    false,
                    ['yes', 'no', 'y', 'n']
                );
                
                fields.push({
                    name: fieldName,
                    value: fieldValue,
                    inline: inline.toLowerCase() === 'yes' || inline.toLowerCase() === 'y'
                });
            }
            
            // Step 6: Footer customization
            let footerText = await this._askQuestion(message, 
                'Enter footer text or type "skip" for default (supports $keywords):',
                false
            );
            footerText = this._processKeywords(footerText);
            
            // Step 7: Final confirmation
            const previewEmbed = this._buildEmbed({
                title: this._processKeywords(title),
                description,
                color,
                thumbnail: thumbnail.toLowerCase() === 'skip' ? null : thumbnail,
                image: image.toLowerCase() === 'skip' ? null : image,
                author: {
                    name: authorName.toLowerCase() === 'skip' ? message.author.username : authorName,
                    iconURL: authorIcon.toLowerCase() === 'skip' ? null : authorIcon,
                    url: authorUrl.toLowerCase() === 'skip' ? null : authorUrl
                },
                fields,
                footer: footerText.toLowerCase() === 'skip' ? 'Preview - Not yet published' : footerText
            });
            
            const confirm = await this._askQuestion(message, 
                { 
                    embeds: [previewEmbed],
                    content: 'Does this look correct? (yes/no)'
                },
                false,
                ['yes', 'no', 'y', 'n']
            );
            
            if (confirm.toLowerCase() === 'no' || confirm.toLowerCase() === 'n') {
                await message.reply('News creation cancelled.');
                return;
            }
            
            // Step 8: Save to file
            const newsData = {
                title: this._processKeywords(title),
                description,
                color: parseInt(color || '3498DB', 16),
                timestamp: new Date().toISOString(),
                thumbnail: thumbnail.toLowerCase() === 'skip' ? null : thumbnail,
                image: image.toLowerCase() === 'skip' ? null : image,
                author: {
                    name: authorName.toLowerCase() === 'skip' ? message.author.username : authorName,
                    icon_url: authorIcon.toLowerCase() === 'skip' ? null : authorIcon,
                    url: authorUrl.toLowerCase() === 'skip' ? null : authorUrl
                },
                footer: {
                    text: footerText.toLowerCase() === 'skip' ? `Posted by ${message.author.username}` : footerText
                },
                fields
            };
            
            const filename = `news_${Date.now()}.json`;
            const newsPath = path.join(__dirname, '../modules/metro/news', filename);
            
            await fs.writeFile(newsPath, JSON.stringify(newsData, null, 2));
            await message.reply(`✅ News file created: \`${filename}\``);
            
        } catch (error) {
            await message.reply(`❌ Error: ${error.message}`);
        }
    },

    _processKeywords(text) {
        if (typeof text !== 'string') return text;
        
        // Replace $keywords with actual values from metroConfig
        return text
            // Logos
            .replace(/\$metroLogo/g, metroConfig.metroLogo.principal)
            .replace(/\$logoV4/g, metroConfig.metroLogo.v4)
            .replace(/\$logoColors/g, metroConfig.metroLogo.logoColores)
            
            // Line emojis
            .replace(/\$line1/g, metroConfig.linesEmojis.l1)
            .replace(/\$line2/g, metroConfig.linesEmojis.l2)
            .replace(/\$line3/g, metroConfig.linesEmojis.l3)
            .replace(/\$line4/g, metroConfig.linesEmojis.l4)
            .replace(/\$line4a/g, metroConfig.linesEmojis.l4a)
            .replace(/\$line5/g, metroConfig.linesEmojis.l5)
            .replace(/\$line6/g, metroConfig.linesEmojis.l6)
            .replace(/\$line7/g, metroConfig.linesEmojis.l7)
            .replace(/\$line8/g, metroConfig.linesEmojis.l8)
            .replace(/\$line9/g, metroConfig.linesEmojis.l9)
            
            // Status emojis
            .replace(/\$statusOperational/g, metroConfig.statusMapping['1'].emoji)
            .replace(/\$statusClosed/g, metroConfig.statusMapping['2'].emoji)
            .replace(/\$statusPartial/g, metroConfig.statusMapping['3'].emoji)
            .replace(/\$statusDelayed/g, metroConfig.statusMapping['4'].emoji)
            .replace(/\$statusExtended/g, metroConfig.statusMapping['5'].emoji)
            
            // Access cards
            .replace(/\$bip/g, metroConfig.accessCards.bip)
            .replace(/\$tne/g, metroConfig.accessCards.tne)
            .replace(/\$bipAM/g, metroConfig.accessCards.bipAdultoMayor)
            .replace(/\$tam/g, metroConfig.accessCards.tarjetaAdultoMayor)
            
            // Connection emojis
            .replace(/\$bus/g, metroConfig.connectionEmojis['Centropuerto'])
            .replace(/\$train/g, metroConfig.connectionEmojis['EFE'])
            .replace(/\$intermodal/g, metroConfig.connectionEmojis['EIM'])
            .replace(/\$busterminal/g, metroConfig.connectionEmojis['Terminal de Buses'])
            
            // Special emojis
            .replace(/\$rendimiento/g, metroConfig.emoji.rendimiento)
            .replace(/\$equipamiento/g, metroConfig.emoji.equipamiento)
            .replace(/\$tecnico/g, metroConfig.emoji.tecnico)
            .replace(/\$tren/g, metroConfig.emoji.tren)
            .replace(/\$fabricante/g, metroConfig.emoji.fabricante)
            .replace(/\$años/g, metroConfig.emoji.años);
    },

    async _askQuestion(message, prompt, required = true, validOptions) {
        const questionMsg = await message.reply(
            typeof prompt === 'string' 
                ? { content: prompt }
                : prompt
        );
        
        try {
            const filter = (m) => m.author.id === message.author.id;
            const collected = await message.channel.awaitMessages({
                filter,
                max: 1,
                time: 60000,
                errors: ['time']
            });
            
            const response = collected.first().content.trim();
            await collected.first().delete();
            
            if (required && !response) {
                throw new Error('Response is required');
            }
            
            if (validOptions && !validOptions.includes(response.toLowerCase())) {
                throw new Error(`Please respond with one of: ${validOptions.join(', ')}`);
            }
            
            return response;
        } finally {
            await questionMsg.delete();
        }
    },

    _buildEmbed({ title, description, color, thumbnail, image, author, fields = [], footer }) {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color);
            
        if (thumbnail) embed.setThumbnail(thumbnail);
        if (image) embed.setImage(image);
        
        if (author) {
            embed.setAuthor({
                name: author.name,
                ...(author.iconURL && { iconURL: author.iconURL }),
                ...(author.url && { url: author.url })
            });
        }
        
        if (fields.length > 0) embed.addFields(fields);
        
        embed.setFooter({ text: footer })
             .setTimestamp();
             
        return embed;
    }
};