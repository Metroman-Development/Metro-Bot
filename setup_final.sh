#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
ENV_FILE=".env"
ENV_EXAMPLE_FILE=".env.example"
DB_SCHEMA_FILE="MetroDB_schema_safe.sql"

# --- Functions ---

# Function to print a message in a consistent format
info() {
    echo "INFO: $1"
}

# Function to print an error message and exit
error() {
    echo "ERROR: $1" >&2
    exit 1
}

# --- Main Script ---

# 1. Check for and create .env file
if [ -f "$ENV_FILE" ]; then
    info "$ENV_FILE already exists. Skipping creation."
else
    info "Creating $ENV_FILE from $ENV_EXAMPLE_FILE..."
    cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"
    info "✅ $ENV_FILE created successfully."
    info "IMPORTANT: You must now edit the $ENV_FILE file with your bot tokens and database credentials."
fi

# 2. Install npm dependencies
#info "Installing npm dependencies..."
#if npm install; then
#    info "✅ npm dependencies installed successfully."
#else
#    error "Failed to install npm dependencies."
#fi

# 3. Import database schema
info "Attempting to import database schema..."
info "This requires the 'mysql' command-line client and the database credentials in $ENV_FILE."

# Source the .env file to get DB credentials
if [ -f "$ENV_FILE" ]; then
    # Use this to avoid issues with empty variables
    set -a
    source "$ENV_FILE"
    set +a
else
    error "$ENV_FILE not found. Cannot proceed with database setup."
fi

# Check if required DB variables are set
if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$METRODB_NAME" ]; then
    error "One or more database variables (DB_HOST, DB_USER, METRODB_NAME) are not set in $ENV_FILE."
fi

info "Checking if the database '$METRODB_NAME' exists..."
if mysql -h "$DB_HOST" -u "$DB_USER" -e "USE $METRODB_NAME;" 2>/dev/null; then
    info "Database '$METRODB_NAME' already exists. Applying schema..."
    if mysql -h "$DB_HOST" -u "$DB_USER" "$METRODB_NAME" < "$DB_SCHEMA_FILE"; then
        info "✅ Database schema updated successfully."
    else
        error "Failed to update database schema."
    fi
else
    info "Database '$METRODB_NAME' does not exist. Creating it..."
    if mysql -h "$DB_HOST" -u "$DB_USER" -e "CREATE DATABASE $METRODB_NAME;"; then
        info "Database '$METRODB_NAME' created successfully."
        info "Importing schema from $DB_SCHEMA_FILE..."
        if mysql -h "$DB_HOST" -u "$DB_USER" "$METRODB_NAME" < "$DB_SCHEMA_FILE"; then
            info "✅ Database schema imported successfully."
        else
            error "Failed to import database schema."
        fi
    else
        error "Failed to create database '$METRODB_NAME'."
    fi
fi

info "🎉 Setup complete! Please review the .env file before running the bot."
