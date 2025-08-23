const path = require('path'); // Import the path module
const fs = require('fs'); // Import the file system module
const { createEmbed } = require('../utils/embeds');
const { getClient } = require('../utils/clientManager'); // Import clientManager to get the client
const { truncate } = require('../utils/logUtils'); // Import the truncate utility

const ERROR_CHANNEL_ID = '1350243847271092295'; // Channel ID for error summaries
const ERROR_LOG_DIR = './errors_new'; // Directory for error logs

// Ensure the errors directory exists
if (!fs.existsSync(ERROR_LOG_DIR)) {
    fs.mkdirSync(ERROR_LOG_DIR, { recursive: true });
}

// Initialize debugMode
let debugMode = true;

// Function to log error to file
function logErrorToFile(error, metadata = {}) {
    try {
        const timestamp = new Date().toISOString();
        const logFileName = path.join(ERROR_LOG_DIR, 'error.log');
        const oldLogFileName = path.join(ERROR_LOG_DIR, 'error.log.old');

        // If the log file exists, rotate it
        if (fs.existsSync(logFileName)) {
            fs.renameSync(logFileName, oldLogFileName);
        }

        const logContent = `[${timestamp}] ERROR: ${error.name}: ${error.message}\n` +
            `Stack: ${error.stack}\n` +
            `Metadata: ${JSON.stringify(metadata, null, 2)}\n\n`;

        fs.writeFileSync(logFileName, logContent); // Use writeFileSync to create a new file
    } catch (fileError) {
        console.error(`Failed to write error log to file: ${fileError.message}`);
    }
}

// Function to send error embed to the specified channel
async function sendErrorEmbed(error, metadata = {}) {
    try {
        // First log the error to file
        logErrorToFile(error, metadata);

        console.log(error, metadata) 
        const client = getClient(); // Get the client using clientManager
        if (!client || !client.channels) {
            console.error('Client or client channels are not available.');
            return;
        }

        const errorChannel = await client.channels.fetch(ERROR_CHANNEL_ID);
        if (!errorChannel) {
            console.error('Error channel not found. Please check the channel ID.');
            return;
        }

        // Create an embed for the error
      /*  const embed = createEmbed(
            `**Error Type:** ${error.name}\n` +
            `**Error Message:** ${error.message}\n` +
            `**Stack Trace:**\n\`\`\`${error.stack}\`\`\`\n` +
            `**Metadata:**\n\`\`\`${JSON.stringify(metadata, null, 2)}\`\`\``,
            'error',
            '🚨 Error Detected'
        );

        // Send the embed to the error channel
        await errorChannel.send({ embeds: [embed] });
        */console.log('Error embed sent to the error channel.');
    } catch (err) {
        console.log(error) 
        
    }
}

// Log levels
const LOG_LEVELS = {
    SILLY: 'SILLY', // Very verbose logs for deep debugging
    TRACE: 'TRACE', // Very detailed logs for debugging
    DEBUG: 'DEBUG', // Debugging information
    INFO: 'INFO',   // General information
    DETAILED: 'DETAILED', // Detailed logs with truncated data
    WARN: 'WARN',   // Warnings
    ERROR: 'ERROR', // Errors
    FATAL: 'FATAL', // Critical errors
};

// Get the file name, line number, and function name
function getCallerInfo() {
    const stack = new Error().stack.split('\n');
    // Add a defensive check for stack length
    if (stack.length < 5) {
        return { fileName: 'unknown', lineNumber: 'unknown', functionName: 'unknown' };
    }
    // The 4th line in the stack trace is the caller
    const callerLine = stack[4];
    if (!callerLine) {
        return { fileName: 'unknown', lineNumber: 'unknown', functionName: 'unknown' };
    }
    const trimmedCallerLine = callerLine.trim();
    const match = trimmedCallerLine.match(/\((.+):(\d+):\d+\)/);
    if (match) {
        const filePath = match[1];
        const lineNumber = match[2];
        const fileName = path.basename(filePath);
        const functionName = trimmedCallerLine.match(/at (.+) \(/)?.[1] || 'anonymous';
        return { fileName, lineNumber, functionName };
    }
    return { fileName: 'unknown', lineNumber: 'unknown', functionName: 'unknown' };
}

// Format the log message
function formatLog(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    let callerInfo = '';
    if (debugMode) {
        const { fileName, lineNumber, functionName } = getCallerInfo();
        callerInfo = `[${fileName}:${lineNumber}] [${functionName}] `;
    }
    return `[${timestamp}] [${level}] ${callerInfo}${message}` +
        (Object.keys(metadata).length > 0 ? `\nMetadata: ${JSON.stringify(metadata, null, 2)}` : '');
}

// Logger functions
const logger = {
    silly: (message, metadata = {}) => {
        if (debugMode && process.env.NODE_ENV !== 'test') {
            console.log("🤪", formatLog(LOG_LEVELS.SILLY, message, metadata));
        }
    },

    trace: (message, metadata = {}) => {
        if (debugMode && process.env.NODE_ENV !== 'test') {
            console.trace("🔍", formatLog(LOG_LEVELS.TRACE, message, metadata));
        }
    },

    system: (message, metadata = {}) => {
        if (debugMode && process.env.NODE_ENV !== 'test') {
            console.log("🔩", formatLog(LOG_LEVELS.INFO, message, metadata));
        }
    },
    
    debug: (message, metadata = {}) => {
        if (debugMode && process.env.NODE_ENV !== 'test') {
            console.log("🐛", formatLog(LOG_LEVELS.INFO, message, metadata));
        }
    },

    info: (message, metadata = {}) => {
        if (process.env.NODE_ENV !== 'test') {
            console.log("ℹ️", formatLog(LOG_LEVELS.INFO, message, metadata));
        }
    },
    
    success: (message, metadata = {}) => {
        if (process.env.NODE_ENV !== 'test') {
            console.log("🎉", formatLog(LOG_LEVELS.INFO, message, metadata));
        }
    },
    
    warn: (message, metadata = {}) => {
        if (process.env.NODE_ENV !== 'test') {
            console.warn("⚠️", formatLog(LOG_LEVELS.WARN, message, metadata));
        }
    },

    error: (message, metadata = {}) => {
        if (process.env.NODE_ENV !== 'test') {
            console.error("❌", formatLog(LOG_LEVELS.ERROR, message, metadata));
        }

        // If the message is an Error object, send it as an embed
        if (message instanceof Error) {
            if (process.env.NODE_ENV !== 'test') sendErrorEmbed(message, metadata);
        } else {
            // If the message is a string, wrap it in an Error object
            const error = new Error(message);
            if (process.env.NODE_ENV !== 'test') sendErrorEmbed(error, metadata);
        }
    },

    fatal: (message, metadata = {}) => {
        if (process.env.NODE_ENV !== 'test') {
            console.error("💀", formatLog(LOG_LEVELS.FATAL, message, metadata));
        }

        // If the message is an Error object, send it as an embed
        if (message instanceof Error) {
            if (process.env.NODE_ENV !== 'test') sendErrorEmbed(message, metadata);
        } else {
            // If the message is a string, wrap it in an Error object
            const error = new Error(message);
            if (process.env.NODE_ENV !== 'test') sendErrorEmbed(error, metadata);
        }
    },

    detailed: (message, data = {}) => {
        if (debugMode && process.env.NODE_ENV !== 'test') {
            const truncatedData = truncate(data);
            console.log("📝", formatLog(LOG_LEVELS.DETAILED, message, truncatedData));
        }
    },

    // Function to enable/disable debug mode
    setDebugMode: (enabled) => {
        debugMode = enabled;
    },
};

module.exports = logger;
