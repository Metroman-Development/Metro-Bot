#!/bin/bash

# Define color codes
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper functions for logging
info() {
    echo -e "${BLUE}INFO: $1${NC}"
}

success() {
    echo -e "${GREEN}INFO: ✅ $1${NC}"
}

error() {
    echo -e "${RED}ERROR: $1${NC}" >&2
}

# Check if a command exists
function check_command() {
    if ! command -v "$1" &> /dev/null; then
        error "$1 could not be found. Please install it."
        exit 1
    fi
}

# Environment file
ENV_FILE=".env"
DB_SCHEMA_FILE="db_schema.sql"

# Create .env from .env.example if it doesn't exist
if [ ! -f "$ENV_FILE" ]; then
    info ".env file not found. Copying from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example "$ENV_FILE"
        success ".env file created successfully."
    else
        error ".env.example not found. Please create a .env file with your database credentials."
        exit 1
    fi
else
    info ".env already exists. Skipping creation."
fi

# Load environment variables
if [ -f "$ENV_FILE" ]; then
    export $(cat "$ENV_FILE" | sed 's/#.*//g' | xargs)
else
    error "Could not find $ENV_FILE"
    exit 1
fi

# Install npm dependencies
info "Installing npm dependencies..."
if ! npm install; then
    error "npm install failed."
    exit 1
fi
success "✅ npm dependencies installed successfully."

# Database setup
info "Attempting to import database schema..."
info "This requires the 'mysql' command-line client and the database credentials in .env."

# Check required commands
check_command mysql

# Check for database connection variables
if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$METRODB_NAME" ]; then
    error "One or more database variables (DB_HOST, DB_USER, METRODB_NAME) are not set in $ENV_FILE."
    exit 1
fi

# Check if database exists
if mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" -e "USE $METRODB_NAME;" 2>/dev/null; then
    info "Database '$METRODB_NAME' already exists. Skipping schema import."
else
    info "Database '$METRODB_NAME' does not exist. Creating and seeding..."
    if mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" -e "CREATE DATABASE $METRODB_NAME;"; then
        success "Database '$METRODB_NAME' created successfully."
        info "Applying schema..."
        if mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$METRODB_NAME" < "$DB_SCHEMA_FILE"; then
            success "Schema applied successfully."
        else
            error "Failed to apply schema."
            exit 1
        fi
        info "Seeding status tables..."
        if mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$METRODB_NAME" < "seed_status_tables.sql"; then
            success "Status tables seeded successfully."
        else
            error "Failed to seed status tables."
        fi
    else
        error "Failed to create database."
        exit 1
    fi
fi

success "Setup finished successfully!"
