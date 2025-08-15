#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Introduction ---
echo "Starting the bot in PRODUCTION mode."
echo "-------------------------------------"

# --- Configuration Loading ---
# This script loads the configuration from a JSON file and passes it to the Node.js application
# via an environment variable. This allows the configuration to be managed separately from the code.

# Define the default path to the config file
CONFIG_JSON_PATH="config.json"

# Allow overriding the config file path with a command-line argument
if [ -n "$1" ]; then
    CONFIG_JSON_PATH="$1"
fi

# Read the config file content into the JSON_CONFIG environment variable
if [ -f "$CONFIG_JSON_PATH" ]; then
    json_config=$(cat "$CONFIG_JSON_PATH")
    export JSON_CONFIG="$json_config"
    echo "INFO: Loaded configuration from $CONFIG_JSON_PATH"
else
    echo "ERROR: Configuration file '$CONFIG_JSON_PATH' not found. Cannot start the bot." >&2
    exit 1
fi

# --- Start the Bot ---
# Execute the main Node.js application
node src/index.js
