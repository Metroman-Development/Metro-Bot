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

async function checkPaths() {
    const allFiles = await getAllFiles('src');
    const errorLog = [];

    console.log(`Found ${allFiles.length} JS files.`);

    for (const file of allFiles) {
        const content = await fs.readFile(file, 'utf-8');
        const requireRegex = /require\((['"])([^'"]+)(['"])\)/g;
        let match;

        while ((match = requireRegex.exec(content)) !== null) {
            const requirePath = match[2];
            if (requirePath.startsWith('.') || requirePath.startsWith('/')) {
                const absoluteRequirePath = path.resolve(path.dirname(file), requirePath);
                try {
                    require.resolve(absoluteRequirePath);
                } catch (e) {
                    errorLog.push(`[INVALID PATH] in ${file}: ${requirePath}`);
                }
            }
        }
    }

    if (errorLog.length > 0) {
        console.log('Found errors in the following files:');
        await fs.writeFile('path_errors.log', errorLog.join('\n'), 'utf-8');
        console.log('A log file with the errors has been created: path_errors.log');
    } else {
        console.log('No path errors found.');
    }
}

checkPaths();
