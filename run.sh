#!/bin/bash
#
# This script manages the services for the bot application.
# It is intended to be used in a production environment where the code
# has already been deployed and dependencies have been installed.
# For deployment, a separate script should handle `git pull` and `npm install`.
#

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Initial Setup ---
echo "Pulling latest changes from git..."
git pull
echo "Installing/updating npm dependencies..."
npm install


# --- Configuration ---
RUN_DIR="run"
LOG_DIR="logs"
mkdir -p "$RUN_DIR"
mkdir -p "$LOG_DIR"

# --- Service Definitions ---

# Core modules that are foundational but not runnable as standalone services
declare -A core_modules
core_modules=(
    [metrocore]="./src/core/metro/MetroCore.js"
    [metro-info-provider]="./src/core/metro/providers/MetroInfoProvider.js"
)

# Application services that run as standalone processes
declare -A app_services
app_services=(
    [discord]="./src/discord-bot.js"
    [telegram]="./src/telegram-bot.js"
    [scheduler]="./src/scheduler.js"
)

# Define all services for easier lookup
declare -A all_services
all_services=(
    ["metrocore"]=1
    ["metro-info-provider"]=1
    ["discord"]=2
    ["telegram"]=2
    ["scheduler"]=2
)


declare -A service_dependencies
service_dependencies=(
    [discord]="scheduler metrocore"
    [telegram]="scheduler metrocore"
    [metrocore]="metro-info-provider"
)

# --- Helper Functions ---

# Check if a service is running
is_running() {
    local service_name="$1"
    local pid_file="$RUN_DIR/$service_name.pid"
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null; then
            return 0 # Service is running
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
    local pid_file="$RUN_DIR/$service_name.pid"
    local log_file="$LOG_DIR/$service_name.log"

    if is_running "$service_name"; then
        echo "Service '$service_name' is already running."
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
    nohup node "$service_script" >> "$log_file" 2>&1 &
    local pid=$!
    echo "$pid" > "$pid_file"
    echo "Service '$service_name' started with PID $pid. Log: $log_file"
}

# Stop a service
stop_service() {
    local service_name="$1"

    # Core modules don't run as separate processes, so they can't be stopped.
    if [ -n "${core_modules[$service_name]}" ]; then
        echo "INFO: Core module '$service_name' cannot be stopped as it is not a running process."
        return
    fi

    local pid_file="$RUN_DIR/$service_name.pid"

    if ! is_running "$service_name"; then
        echo "Service '$service_name' is not running."
        return
    fi

    echo "Stopping service '$service_name'..."
    local pid=$(cat "$pid_file")
    kill "$pid"
    rm -f "$pid_file"
    echo "Service '$service_name' stopped."
}

# Show status of services
show_status() {
    echo "--- Service Status ---"
    echo "Application Services:"
    for service_name in "${!app_services[@]}"; do
        if is_running "$service_name"; then
            local pid=$(cat "$RUN_DIR/$service_name.pid")
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
