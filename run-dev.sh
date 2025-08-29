#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Introduction ---
echo "Starting the bot in DEVELOPMENT mode with nodemon."
echo "The bot will automatically restart when source files in 'src/' are changed."
echo "Press Ctrl+C to exit."
echo "--------------------------------------------------"

# --- Configuration Loading ---
CONFIG_JSON_PATH="config.json"

# Check if a custom config path is provided as an argument
if [ -n "$1" ]; then
    CONFIG_JSON_PATH="$1"
fi

# Load config into environment variable
if [ -f "$CONFIG_JSON_PATH" ]; then
    json_config=$(cat "$CONFIG_JSON_PATH")
    export JSON_CONFIG="$json_config"
    echo "INFO: Loaded configuration from $CONFIG_JSON_PATH"
else
    echo "WARNING: Configuration file '$CONFIG_JSON_PATH' not found. The bot may not function correctly."
fi

# --- Run with Nodemon ---
# We use npx to run the local version of nodemon installed from package.json.
# We watch only the 'src' directory for changes.
export ESTADO_RED='http://localhost:3000/estadoRed'
npx nodemon --watch src/ src/index.js > app_output.log 2>&1
