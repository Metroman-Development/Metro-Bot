#!/bin/bash

# --- Configuration ---
LOG_DIR="logs"
RUN_DIR="run"

# Check if the logs directory exists
if [ ! -d "$LOG_DIR" ]; then
    echo "Error: Log directory '$LOG_DIR' not found."
    echo "Please run the main application script first to generate logs."
    exit 1
fi

# --- Service Definitions ---
# Read app_services from run.sh to make this script dynamic
app_services=()
while IFS= read -r line; do
    if [[ "$line" =~ \[([a-zA-Z0-9_-]+)\]=\"\./src/([a-zA-Z0-9_-]+)-bot\.js\" || "$line" =~ \[([a-zA-Z0-9_-]+)\]=\"\./src/(scheduler)\.js\" ]]; then
        app_services+=("${BASH_REMATCH[1]}")
    fi
done < run.sh


# --- Main Menu ---
echo "--- Log Viewer ---"
echo "Select a service to view its logs:"

PS3="Enter your choice (or 'q' to quit): "
options=()
for service in "${app_services[@]}"; do
    options+=("$service")
done
options+=("all" "quit")

select opt in "${options[@]}"; do
    case "$opt" in
        "quit")
            echo "Exiting."
            break
            ;;
        "all")
            echo "Showing all logs. Press Ctrl+C to exit."
            tail -f "$LOG_DIR"/*.log
            break
            ;;
        *)
            if [[ " ${app_services[@]} " =~ " ${opt} " ]]; then
                log_file="$LOG_DIR/$opt.log"
                if [ -f "$log_file" ]; then
                    echo "Showing logs for '$opt'. Press Ctrl+C to exit."
                    tail -f "$log_file"
                else
                    echo "Log file for '$opt' not found."
                fi
            else
                echo "Invalid option. Please try again."
            fi
            break
            ;;
    esac
done

exit 0
