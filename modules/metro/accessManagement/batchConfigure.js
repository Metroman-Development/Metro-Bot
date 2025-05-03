const path = require('path');
const fs = require('fs').promises;
const { EmbedBuilder } = require('discord.js');

class BatchConfigure {
    async handleReplaceOperation(message, args) {
        try {
            const params = this.parseReplaceParams(args);
            if (!params.valid) {
                return this.sendError(message,
                    `❌ Sintaxis incorrecta. Ejemplo:\n` +
                    '`!stationaccess replace [target] [property] "old" with "new" [filters]`\n' +
                    'Ejemplo real:\n' +
                    '`!stationaccess replace all description "Av." with "Avenida" in stations including "l1"`'
                );
            }

            const files = await fs.readdir(path.join(__dirname, '../data/json/accessDetails'));
            const results = [];
            let totalModified = 0;

            for (const file of files) {
                if (!file.endsWith('.json')) continue;

                const filePath = path.join(__dirname, '../data/json/accessDetails', file);
                const config = JSON.parse(await fs.readFile(filePath, 'utf8'));

                if (params.stationFilter && 
                    !config.station.toLowerCase().includes(params.stationFilter.toLowerCase())) {
                    continue;
                }

                const modified = this.processTextReplace(config, params);
                if (modified > 0) {
                    totalModified++;
                    await fs.writeFile(filePath, JSON.stringify(config, null, 2));
                    results.push(`✅ ${config.station} ${config.line}: ${modified} cambios`);
                }
            }

            const embed = new EmbedBuilder()
                .setColor(totalModified > 0 ? 0x00FF00 : 0xFFA500)
                .setTitle(`🔧 Resultados de reemplazo`)
                .setDescription(
                    `Estaciones modificadas: **${totalModified}**\n` +
                    `**Cambio:** \`${params.oldValue}\` → \`${params.newValue}\``
                );

            if (results.length > 0) {
                const chunks = this.chunkArray(results, 5);
                chunks.forEach((chunk, i) => {
                    embed.addFields({
                        name: `Cambios ${i+1}/${chunks.length}`,
                        value: chunk.join('\n'),
                        inline: false
                    });
                });
            }

            return message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Replace Error:', error);
            return this.sendError(message, `❌ Error en reemplazo: ${error.message}`);
        }
    }

    parseReplaceParams(args) {
        const params = {
            valid: false,
            target: 'all',
            property: null,
            oldValue: null,
            newValue: null,
            isRegex: false,
            stationFilter: null,
            condition: null
        };

        try {
            let i = 0;
            
            // Parse target
            if (i < args.length) {
                params.target = args[i++].toLowerCase();
            }

            // Parse property
            if (i < args.length) {
                params.property = args[i++].toLowerCase();
            }

            // Parse old value
            if (i < args.length) {
                const val = args[i];
                if (val.startsWith('/') && val.endsWith('/')) {
                    params.oldValue = new RegExp(val.slice(1, -1), 'gi');
                    params.isRegex = true;
                } else {
                    params.oldValue = val.replace(/^["']|["']$/g, '');
                }
                i++;
            }

            // Expect "with" keyword
            if (i >= args.length || args[i++].toLowerCase() !== 'with') {
                return params;
            }

            // Parse new value
            if (i < args.length) {
                params.newValue = args[i].replace(/^["']|["']$/g, '');
                i++;
            }

            // Parse optional filters
            while (i < args.length) {
                if (args[i]?.toLowerCase() === 'in' && args[i+1]?.toLowerCase() === 'stations') {
                    i += 2;
                    if (args[i]?.toLowerCase() === 'including') {
                        i++;
                        params.stationFilter = args[i++].replace(/^["']|["']$/g, '');
                    }
                }
                else if (args[i]?.toLowerCase() === 'if') {
                    i++;
                    params.condition = {
                        property: args[i++],
                        operator: args[i++]?.toLowerCase(),
                        value: args[i++].replace(/^["']|["']$/g, '')
                    };
                }
                else {
                    i++;
                }
            }

            params.valid = !!params.property && params.oldValue !== null && params.newValue !== null;
            return params;

        } catch (error) {
            console.error('Replace Parse Error:', error);
            return params;
        }
    }

    processTextReplace(config, params) {
        let modified = 0;
        const elements = [];

        // Select target elements
        if (params.target === 'all') {
            elements.push(...config.accesses, ...config.elevators, ...config.escalators);
        } else if (config[params.target]) {
            elements.push(...config[params.target]);
        }

        // Process each element
        for (const element of elements) {
            // Check conditions
            if (params.condition) {
                const elementValue = String(element[params.condition.property] || '').toLowerCase();
                const conditionValue = params.condition.value.toLowerCase();
                
                let matches;
                switch (params.condition.operator) {
                    case 'equals': matches = elementValue === conditionValue; break;
                    case 'includes': matches = elementValue.includes(conditionValue); break;
                    case 'startswith': matches = elementValue.startsWith(conditionValue); break;
                    case 'endswith': matches = elementValue.endsWith(conditionValue); break;
                    case 'matches': 
                        try {
                            matches = new RegExp(conditionValue, 'i').test(elementValue);
                        } catch {
                            matches = false;
                        }
                        break;
                    default: matches = false;
                }
                if (!matches) continue;
            }

            // Perform replacement
            const originalValue = element[params.property];
            if (typeof originalValue !== 'string') continue;

            let newValue;
            if (params.isRegex) {
                newValue = originalValue.replace(params.oldValue, params.newValue);
            } else {
                newValue = originalValue.replace(
                    new RegExp(this.escapeRegExp(params.oldValue), 'g'), 
                    params.newValue
                );
            }

            if (newValue !== originalValue) {
                element[params.property] = newValue;
                element.lastUpdated = new Date().toISOString();
                modified++;

                // Record change
                config.changeHistory.push({
                    timestamp: new Date().toISOString(),
                    user: `${message.author.tag} (Replace)`,
                    action: 'Reemplazo de texto',
                    details: `${element.id}: ${params.property} "${originalValue}" → "${newValue}"`
                });
            }
        }

        if (modified > 0) {
            config.lastUpdated = new Date().toISOString();
        }

        return modified;
    }

    async handleAdvancedEdit(message, args) {
        console.log(`\n[ADVANCED EDIT STARTED] ${message.author.tag} | Args: ${args.join(' ')}`);
        
        try {
            // 1. Parse Command
            console.log('[STEP 1/4] Parsing command...');
            const params = this.parseAdvancedEditParams(args);
            
            if (!params.valid) {
                console.error('[ERROR] Invalid parameters:', params.error);
                return this.sendError(message, 
                    `❌ Syntax error. Example:\n` +
                    `\`!stationaccess aedit [target] [property] to "value" ` +
                    `[if property operator "value"]\``
                );
            }

            // 2. Dry-run check (safety feature)
            const isDryRun = args.includes('dryrun');
            if (isDryRun) {
                console.log('[DRY RUN MODE] Changes will not be saved');
            }

            // 3. Process Files
            console.log('[STEP 2/4] Scanning station files...');
            const accessDir = path.join(__dirname, '../data/json/accessDetails');
            const files = await fs.readdir(accessDir);
            const accessFiles = files.filter(f => f.endsWith('.json'));
            
            if (accessFiles.length === 0) {
                console.error('[ERROR] No station files found');
                return this.sendError(message, 'No station data available');
            }

            // 4. Batch Processing
            console.log(`[STEP 3/4] Processing ${accessFiles.length} files...`);
            const results = [];
            const changeSummary = {
                totalModified: 0,
                stationsModified: 0,
                elementsByType: { accesses: 0, elevators: 0, escalators: 0 }
            };

            for (const file of accessFiles) {
                const filePath = path.join(accessDir, file);
                console.log(`\n[PROCESSING] ${file}`);
                
                try {
                    const config = JSON.parse(await fs.readFile(filePath, 'utf8'));
                    const modifiedCount = this.processBatchEdit(config, params);
                    
                    if (modifiedCount > 0) {
                        changeSummary.totalModified += modifiedCount;
                        changeSummary.stationsModified++;
                        
                        if (params.target === 'all') {
                            changeSummary.elementsByType.accesses += (config.accesses || []).filter(a => a.lastUpdated === new Date().toISOString()).length;
                            changeSummary.elementsByType.elevators += (config.elevators || []).filter(e => e.lastUpdated === new Date().toISOString()).length;
                            changeSummary.elementsByType.escalators += (config.escalators || []).filter(s => s.lastUpdated === new Date().toISOString()).length;
                        }

                        if (!isDryRun) {
                            await fs.writeFile(filePath, JSON.stringify(config, null, 2));
                            console.log(`[SAVED] ${modifiedCount} changes`);
                        } else {
                            console.log(`[DRY RUN] Would save ${modifiedCount} changes`);
                        }

                        results.push(`🛠 **${config.station} ${config.line}**: ${modifiedCount} edits`);
                    }
                } catch (err) {
                    console.error(`[FILE ERROR] ${file}:`, err);
                }
            }

            // 5. Send Results
            console.log('[STEP 4/4] Generating report...');
            const elapsed = ((Date.now() - performance.now()) / 1000).toFixed(2);
            
            if (changeSummary.totalModified === 0) {
                console.log('[COMPLETE] No changes made');
                return this.sendSuccess(message, 'No elements matched your criteria');
            }

            const embed = new EmbedBuilder()
                .setColor(isDryRun ? 0xFFFF00 : 0x00FF00)
                .setTitle(`${isDryRun ? 'DRY RUN: ' : ''}Batch Edit Complete`)
                .setDescription([
                    `⏱ **Time**: ${elapsed}s`,
                    `🏭 **Stations Modified**: ${changeSummary.stationsModified}`,
                    `📊 **Total Changes**: ${changeSummary.totalModified}`,
                    `├─ Accesses: ${changeSummary.elementsByType.accesses}`,
                    `├─ Elevators: ${changeSummary.elementsByType.elevators}`,
                    `└─ Escalators: ${changeSummary.elementsByType.escalators}`,
                    isDryRun ? '\n⚠ **Dry Run**: No changes saved' : ''
                ].join('\n'));

            // Paginate results if many stations
            const chunks = this.chunkArray(results, 5);
            chunks.forEach((chunk, i) => {
                embed.addFields({
                    name: `Modified Stations ${i + 1}/${chunks.length}`,
                    value: chunk.join('\n'),
                    inline: false
                });
            });

            // Add edit summary
            embed.addFields({
                name: 'Edit Summary',
                value: [
                    '```diff',
                    `! ${params.target} ${params.property}`,
                    `+ Changed to: "${params.newValue}"`,
                    params.condition ? `? Condition: ${params.condition.property} ${params.condition.operator} "${params.condition.value}"` : '',
                    '```'
                ].filter(Boolean).join('\n')
            });

            console.log('[COMPLETE] Sending results');
            return message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('[FATAL ERROR]', error);
            return this.sendError(message, `❌ Critical error: ${error.message}`);
        }
    }

    parseAdvancedEditParams(args) {
        console.log('[AEDIT PARSER] Starting parse with args:', args.join(' '));
        
        const params = {
            valid: false,
            target: null,
            property: null,
            newValue: null,
            stationFilter: null,
            condition: null,
            error: null
        };

        try {
            let i = 0;
            const validTargets = ['all', 'accesses', 'elevators', 'escalators'];
            const validProperties = ['name', 'description', 'status', 'notes', 'from', 'to', 'fullPath'];

            // 1. Parse target (required)
            params.target = args[i++]?.toLowerCase();
            if (!validTargets.includes(params.target)) {
                params.error = `Invalid target: ${params.target}`;
                return params;
            }

            // 2. Parse property (required)
            params.property = args[i++]?.toLowerCase();
            if (!validProperties.includes(params.property)) {
                params.error = `Invalid property: ${params.property}`;
                return params;
            }

            // 3. Require "to" keyword
            if (args[i++]?.toLowerCase() !== 'to') {
                params.error = 'Missing "to" keyword';
                return params;
            }

            // 4. Parse new value (all tokens until next keyword)
            params.newValue = '';
            while (i < args.length && !['in', 'if'].includes(args[i]?.toLowerCase())) {
                params.newValue += args[i++] + ' ';
            }
            params.newValue = params.newValue.trim().replace(/^"|"$/g, '');

            // 5. Parse optional station filter
            if (i < args.length && args[i]?.toLowerCase() === 'in') {
                i += 2; // Skip "in stations"
                if (args[i++]?.toLowerCase() !== 'including') {
                    params.error = 'Expected "including" after "in stations"';
                    return params;
                }
                params.stationFilter = args[i++]?.replace(/^"|"$/g, '');
            }

            // 6. Parse optional condition
            if (i < args.length && args[i]?.toLowerCase() === 'if') {
                i++;
                params.condition = {
                    property: args[i++]?.toLowerCase(),
                    operator: args[i++]?.toLowerCase(),
                    value: args.slice(i).join(' ').replace(/^"|"$/g, '')
                };
            }

            params.valid = true;
            console.log('[PARSER SUCCESS]', JSON.stringify(params, null, 2));
        } catch (error) {
            console.error('[PARSER CRASH]', error);
            params.error = error.message;
        }

        return params;
    }

    processBatchEdit(config, params) {
        console.log(`\n[START BATCH EDIT] ${config.station} ${config.line}`);
        console.log(`[PARAMS] ${JSON.stringify(params, null, 2)}`);

        // 1. Initialize tracking
        const changes = [];
        const pathUpdates = new Set();
        let modifiedCount = 0;

        // 2. Select target elements
        const elements = this.getTargetElements(config, params.target);
        console.log(`[TARGETS] Processing ${elements.length} ${params.target} elements`);

        // 3. Process each element
        elements.forEach((element, index) => {
            console.log(`\n[PROCESSING ${index + 1}/${elements.length}] ${element.id}`);
            
            // 3.1 Check conditions
            if (params.condition && !this.evaluateCondition(element, params.condition)) {
                console.log(`[SKIPPED] Condition not met`);
                return;
            }

            // 3.2 Apply primary edit
            const oldValue = element[params.property];
            element[params.property] = params.newValue;
            element.lastUpdated = new Date().toISOString();
            modifiedCount++;

            console.log(`[CHANGED] ${params.property}: ${oldValue} → ${params.newValue}`);
            changes.push({
                id: element.id,
                type: params.target.slice(0, -1), // Remove 's' (accesses → access)
                property: params.property,
                oldValue,
                newValue: params.newValue
            });

            // 3.3 Handle path dependencies if editing location-related fields
            if (this.isPathProperty(params.property)) {
                console.log(`[PATH EDIT] Detected location change, updating dependencies...`);
                const dependencies = this.updatePathDependencies(config, oldValue, params.newValue);
                dependencies.forEach(dep => pathUpdates.add(dep));
            }

            // 3.4 Record in change history
            config.changeHistory.push({
                timestamp: new Date().toISOString(),
                user: `${message.author.tag} (Batch)`,
                action: 'Edición avanzada',
                details: `${element.id}: ${params.property} cambiado de "${oldValue}" a "${params.newValue}"` +
                        (pathUpdates.size > 0 ? ` (+${pathUpdates.size} dependencias)` : '')
            });
        });

        // 4. Final updates
        if (modifiedCount > 0) {
            config.lastUpdated = new Date().toISOString();
            console.log(`\n[SUMMARY] Modified ${modifiedCount} elements with ${pathUpdates.size} path updates`);
        } else {
            console.log(`[SUMMARY] No elements modified`);
        }

        return modifiedCount;
    }

    getTargetElements(config, target) {
        switch (target) {
            case 'all':
                return [
                    ...(config.accesses || []),
                    ...(config.elevators || []),
                    ...(config.escalators || [])
                ];
            default:
                return config[target] || [];
        }
    }

    evaluateCondition(element, condition) {
        const elementValue = String(element[condition.property] || '').toLowerCase();
        const conditionValue = condition.value.toLowerCase();
        
        // Special handling for line numbers (L1 vs 1)
        if (condition.property === 'line') {
            const normalize = val => val.replace(/^l/i, '');
            return this.compareValues(
                normalize(elementValue),
                normalize(conditionValue),
                condition.operator
            );
        }
        
        return this.compareValues(elementValue, conditionValue, condition.operator);
    }

    compareValues(a, b, operator) {
        switch (operator) {
            case '!': case 'not':       return a !== b;
            case '!==':                 return a !== b;
            case '===':                return a === b;
            case 'includes':           return a.includes(b);
            case 'startsWith':         return a.startsWith(b);
            case 'endsWith':           return a.endsWith(b);
            case 'matches':
                try { return new RegExp(b, 'i').test(a); } 
                catch { return false; }
            default: /* 'equals', '==' */ return a === b;
        }
    }

    isPathProperty(property) {
        return ['from', 'to', 'fullPath'].includes(property);
    }

    updatePathDependencies(config, oldValue, newValue) {
        const updatedElements = [];
        
        ['accesses', 'elevators', 'escalators'].forEach(type => {
            config[type]?.forEach(element => {
                let modified = false;
                
                // Update direct fields
                if (element.from === oldValue) {
                    element.from = newValue;
                    modified = true;
                }
                if (element.to === oldValue) {
                    element.to = newValue;
                    modified = true;
                }
                
                // Update full path
                if (element.fullPath?.includes(oldValue)) {
                    element.fullPath = element.fullPath.replace(
                        new RegExp(`\\b${this.escapeRegExp(oldValue)}\\b`, 'g'),
                        newValue
                    );
                    modified = true;
                }
                
                // Update segments if they exist
                if (modified && Array.isArray(element.segments)) {
                    element.segments = element.segments.map(seg => 
                        typeof seg === 'string'
                            ? seg.replace(new RegExp(`\\b${this.escapeRegExp(oldValue)}\\b`, 'g'), newValue)
                            : seg
                    );
                }
                
                if (modified) {
                    element.lastUpdated = new Date().toISOString();
                    updatedElements.push(`${type.slice(0, -1)} ${element.id}`);
                }
            });
        });
        
        return updatedElements;
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
}

module.exports = BatchConfigure;