#!/bin/bash
#
# This script manages the services for the bot application.
# It is intended to be used in a production environment where the code
# has already been deployed and dependencies have been installed.
# For deployment, a separate script should handle `git pull` and `npm install`.
#

# Exit immediately if a command exits with a non-zero status.
# set -e

# Export environment variables from .env file
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# --- Initial Setup ---
if [ -f .env ] && grep -q "^SKIPGITPULL=true" .env; then
    echo "INFO: SKIPGITPULL is true in .env, skipping git pull and npm install."
else
    echo "Pulling latest changes from git..."
    git pull
    echo "Installing/updating npm dependencies..."
    npm install
fi


# --- Configuration ---
RUN_DIR="run"
LOG_DIR="logs"
mkdir -p "$RUN_DIR"
mkdir -p "$LOG_DIR"

# --- Service Definitions ---

# Core modules that are foundational but not runnable as standalone services
declare -A core_modules
core_modules=(
    [metro-info-provider]="./src/utils/MetroInfoProvider.js"
)

# Application services that run as standalone processes
declare -A app_services
app_services=(
    [discord]="./src/discord-bot.js"
    [telegram]="./src/telegram-bot.js"
    [scheduler]="./src/scheduler.js"
    [api]="./api.js"
)

# Define all services for easier lookup
declare -A all_services
all_services=(
    ["metro-info-provider"]=1
    ["discord"]=2
    ["telegram"]=2
    ["scheduler"]=2
    ["api"]=2
)


declare -A service_dependencies
service_dependencies=(
    [discord]="scheduler"
    [telegram]="scheduler"
)

# --- Helper Functions ---

# Rotate log file if it exceeds a certain size
rotate_log() {
    local log_file="$1"
    local max_size=$((10 * 1024 * 1024)) # 10 MB

    if [ -f "$log_file" ]; then
        local file_size=$(stat -c%s "$log_file")
        if [ "$file_size" -gt "$max_size" ]; then
            echo "Rotating log file: $log_file"
            # Keep the last 10MB of the log file
            tail -c "$max_size" "$log_file" > "$log_file.tmp" && mv "$log_file.tmp" "$log_file"
        fi
    fi
}

# Check if a service is running by looking for its PID file
is_running() {
    local service_name="$1"
    local pid_file="$RUN_DIR/$service_name.pid"

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null; then
            return 0 # Service is running
        else
            # The process is not running, but the PID file exists. Clean it up.
            echo "Warning: Stale PID file found for '$service_name'. Removing it."
            rm -f "$pid_file"
            return 1 # Service is not running
        fi
    fi
    return 1 # Service is not running
}

# Start a service
start_service() {
    local service_name="$1"

    # Check if it's a core module
    if [ -n "${core_modules[$service_name]}" ]; then
        echo "INFO: Core module '$service_name' is a foundational component and will be loaded by application services."
        return
    fi

    # Check if it's an app service
    if [ -z "${app_services[$service_name]}" ]; then
        echo "Error: Unknown service '$service_name'"
        exit 1
    fi

    local service_script="${app_services[$service_name]}"
    local log_file="$LOG_DIR/$service_name.log"
    local pid_file="$RUN_DIR/$service_name.pid"

    if is_running "$service_name"; then
        local pid=$(cat "$pid_file")
        echo "Service '$service_name' is already running with PID $pid."
        return
    fi

    # Check for dependencies
    local dependencies="${service_dependencies[$service_name]}"
    if [ -n "$dependencies" ]; then
        for dep in $dependencies; do
            if [ -n "${core_modules[$dep]}" ]; then
                echo "INFO: Acknowledging dependency on core module '$dep' for service '$service_name'."
            elif ! is_running "$dep"; then
                echo "Dependency '$dep' for service '$service_name' is not running. Starting it now..."
                start_service "$dep"
                echo "Waiting for dependency '$dep' to start..."
                sleep 5
            fi
        done
    fi

    echo "Starting service '$service_name'..."
    rotate_log "$log_file"

    # Start the service in the background and get its PID
    nohup node "$service_script" > "$log_file" 2>&1 &
    local pid=$!

    # Save the PID to a file
    echo "$pid" > "$pid_file"

    sleep 1 # Give the process a moment to stabilize

    # Verify that the process started correctly
    if ! is_running "$service_name"; then
        echo "Error: Failed to start service '$service_name'. Check the log for details: $log_file"
        rm -f "$pid_file" # Clean up the PID file
        exit 1
    fi

    echo "Service '$service_name' started with PID $pid. Log: $log_file"
}

# Stop a service
stop_service() {
    local service_name="$1"

    if [ -n "${core_modules[$service_name]}" ]; then
        echo "INFO: Core module '$service_name' cannot be stopped as it is not a running process."
        return
    fi

    local pid_file="$RUN_DIR/$service_name.pid"

    if ! is_running "$service_name"; then
        echo "Service '$service_name' is not running."
        # Attempt to kill any lingering processes that may have escaped PID tracking
        local service_script="${app_services[$service_name]}"
        if pgrep -f "node $service_script" > /dev/null; then
            echo "Warning: Found lingering processes for '$service_name' without a PID file. Attempting to stop them..."
            pkill -f "node $service_script"
        fi
        return
    fi

    local pid=$(cat "$pid_file")
    echo "Stopping service '$service_name' (PID: $pid)..."

    # Try to gracefully terminate the process
    kill "$pid"

    # Wait for the process to stop
    local counter=0
    while ps -p "$pid" > /dev/null; do
        sleep 1
        counter=$((counter + 1))
        if [ "$counter" -ge 10 ]; then
            echo "Service '$service_name' did not stop gracefully. Forcing termination..."
            kill -9 "$pid"
            break
        fi
    done

    rm -f "$pid_file"
    echo "Service '$service_name' stopped."
}

# Show status of services
show_status() {
    echo "--- Service Status ---"
    echo "Application Services:"
    for service_name in "${!app_services[@]}"; do
        local pid_file="$RUN_DIR/$service_name.pid"
        if is_running "$service_name"; then
            local pid=$(cat "$pid_file")
            echo "  [RUNNING] $service_name (PID: $pid)"
        else
            echo "  [STOPPED] $service_name"
        fi
    done
    echo ""
    echo "Core Modules:"
    for module_name in "${!core_modules[@]}"; do
        echo "  [LOADED]  $module_name (as a foundational component)"
    done
    echo "----------------------"
}

# --- Main Script Logic ---

# Load configuration from config.json
CONFIG_JSON_PATH="config.json"
if [ -f "$CONFIG_JSON_PATH" ]; then
    export JSON_CONFIG=$(cat "$CONFIG_JSON_PATH")
    echo "INFO: Loaded configuration from $CONFIG_JSON_PATH"
else
    echo "ERROR: Configuration file '$CONFIG_JSON_PATH' not found." >&2
    exit 1
fi

COMMAND="${1:-start}" # Default to 'start' if no command is provided
SERVICE="$2"

case "$COMMAND" in
    start)
        if [ -z "$SERVICE" ]; then
            echo "Starting all application services..."
            for service_name in "${!app_services[@]}"; do
                start_service "$service_name"
            done
        else
            if [ -n "${all_services[$SERVICE]}" ]; then
                start_service "$SERVICE"
            else
                echo "Error: Unknown service '$SERVICE'"
                exit 1
            fi
        fi
        show_status
        ;;
    stop)
        if [ -z "$SERVICE" ]; then
            echo "Stopping all application services..."
            for service_name in "${!app_services[@]}"; do
                stop_service "$service_name"
            done
        else
            if [ -n "${all_services[$SERVICE]}" ]; then
                stop_service "$SERVICE"
            else
                echo "Error: Unknown service '$SERVICE'"
                exit 1
            fi
        fi
        show_status
        ;;
    restart)
        if [ -z "$SERVICE" ]; then
            echo "Restarting all application services..."
            for service_name in "${!app_services[@]}"; do
                stop_service "$service_name"
                start_service "$service_name"
            done
        else
            if [ -n "${all_services[$SERVICE]}" ]; then
                stop_service "$SERVICE"
                start_service "$SERVICE"
            else
                echo "Error: Unknown service '$SERVICE'"
                exit 1
            fi
        fi
        show_status
        ;;
    status)
        show_status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status} [service_name]"
        echo "Application Services: ${!app_services[@]}"
        echo "Core Modules: ${!core_modules[@]}"
        exit 1
        ;;
esac

exit 0
