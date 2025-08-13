const fs = require('fs').promises;
const path = require('path');

async function getAllFiles(dirPath, arrayOfFiles) {
    const files = await fs.readdir(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
            await getAllFiles(filePath, arrayOfFiles);
        } else {
            if (file.endsWith('.js')) {
                arrayOfFiles.push(filePath);
            }
        }
    }

    return arrayOfFiles;
}

async function fixPaths() {
    console.log('Getting all files...');
    const allFiles = await getAllFiles('src');
    console.log(`Found ${allFiles.length} JS files.`);

    for (const file of allFiles) {
        console.log(`Processing ${file}...`); // Added logging
        let content = await fs.readFile(file, 'utf-8');
        const originalContent = content;

        const requireRegex = /require\((['"])([^'"]+)(['"])\)/g;
        let match;

        while ((match = requireRegex.exec(content)) !== null) {
            const requirePath = match[2];
            if (requirePath.startsWith('.') || requirePath.startsWith('/')) {
                const absoluteRequirePath = path.resolve(path.dirname(file), requirePath);
                try {
                    require.resolve(absoluteRequirePath);
                } catch (e) {
                    // --- Start of generic path fixing logic ---
                    const parts = requirePath.split('/');
                    const moduleName = parts[parts.length - 1];
                    let newPath = null;

                    // Try to find the module in the project
                    for (const otherFile of allFiles) {
                        if (otherFile.endsWith(moduleName + '.js')) {
                            newPath = path.relative(path.dirname(file), otherFile).replace(/\\/g, '/');
                            break;
                        }
                    }

                    if (newPath) {
                        try {
                            const newAbsoluteRequirePath = path.resolve(path.dirname(file), newPath);
                            require.resolve(newAbsoluteRequirePath);
                            console.log(`[FIXED] ${file}: ${requirePath} -> ${newPath}`);
                            content = content.replace(requirePath, newPath);
                        } catch (e2) {
                            console.log(`[FAILED] ${file}: Could not resolve ${newPath}`);
                        }
                    } else if (requirePath.endsWith('.json')) {
                        console.log(`[REPLACED] ${file}: ${requirePath} -> {}`);
                        content = content.replace(`require('${requirePath}')`, '{}');
                         content = content.replace(`require("${requirePath}")`, '{}');
                    } else {
                        console.log(`[NOT FOUND] ${file}: ${requirePath}`);
                    }
                    // --- End of generic path fixing logic ---
                }
            }
        }

        if (content !== originalContent) {
            console.log(`Writing changes to ${file}`); // Added logging
            await fs.writeFile(file, content, 'utf-8');
        }
    }
    console.log('Finished fixing paths.');
}

fixPaths();
