#!/bin/bash

# Data Migration Script: Migrate existing data to projects/default
# This script should be run ONCE during the upgrade to project mode

set -e  # Exit on error

echo "======================================"
echo "Project Mode Data Migration Script"
echo "======================================"
echo ""

# Determine the AttackTrace config directory
if [ -z "$ATTACKTRACE_CONFIG_DIR" ]; then
    if [ "$(uname)" == "Darwin" ]; then
        # macOS
        ATTACKTRACE_DIR="$HOME/.attacktrace"
    elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
        # Linux
        ATTACKTRACE_DIR="$HOME/.attacktrace"
    else
        echo "Unsupported operating system"
        exit 1
    fi
else
    ATTACKTRACE_DIR="$ATTACKTRACE_CONFIG_DIR"
fi

echo "AttackTrace directory: $ATTACKTRACE_DIR"
echo ""

# Check if the directory exists
if [ ! -d "$ATTACKTRACE_DIR" ]; then
    echo "AttackTrace directory not found. Nothing to migrate."
    exit 0
fi

# Define paths
OLD_CONFIG="$ATTACKTRACE_DIR/mcp_config.json"
OLD_DB="$ATTACKTRACE_DIR/db.sqlite"
DEFAULT_PROJECT_DIR="$ATTACKTRACE_DIR/projects/default"
NEW_CONFIG="$DEFAULT_PROJECT_DIR/mcp_config.json"
NEW_DB="$DEFAULT_PROJECT_DIR/db.sqlite"
BACKUP_DIR="$ATTACKTRACE_DIR/backup_$(date +%Y%m%d_%H%M%S)"

echo "Checking for existing data..."

# Check if migration is needed
MIGRATION_NEEDED=false

if [ -f "$OLD_CONFIG" ] || [ -f "$OLD_DB" ]; then
    MIGRATION_NEEDED=true
fi

if [ "$MIGRATION_NEEDED" = false ]; then
    echo "No migration needed. Old files not found."
    exit 0
fi

echo "Migration needed. Starting migration process..."
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Create default project directory
mkdir -p "$DEFAULT_PROJECT_DIR"
echo "Created default project directory: $DEFAULT_PROJECT_DIR"

# Migrate mcp_config.json
if [ -f "$OLD_CONFIG" ]; then
    if [ ! -f "$NEW_CONFIG" ]; then
        echo "Migrating mcp_config.json..."
        cp "$OLD_CONFIG" "$NEW_CONFIG"
        cp "$OLD_CONFIG" "$BACKUP_DIR/mcp_config.json"
        echo "  ✓ Copied to $NEW_CONFIG"
        echo "  ✓ Backup created at $BACKUP_DIR/mcp_config.json"
    else
        echo "Warning: $NEW_CONFIG already exists. Skipping migration."
        cp "$OLD_CONFIG" "$BACKUP_DIR/mcp_config.json"
        echo "  ✓ Backup created at $BACKUP_DIR/mcp_config.json"
    fi
fi

# Migrate db.sqlite
if [ -f "$OLD_DB" ]; then
    if [ ! -f "$NEW_DB" ]; then
        echo "Migrating db.sqlite..."
        cp "$OLD_DB" "$NEW_DB"
        cp "$OLD_DB" "$BACKUP_DIR/db.sqlite"
        echo "  ✓ Copied to $NEW_DB"
        echo "  ✓ Backup created at $BACKUP_DIR/db.sqlite"
    else
        echo "Warning: $NEW_DB already exists. Skipping migration."
        cp "$OLD_DB" "$BACKUP_DIR/db.sqlite"
        echo "  ✓ Backup created at $BACKUP_DIR/db.sqlite"
    fi
fi

# Create cache and reports subdirectories
mkdir -p "$DEFAULT_PROJECT_DIR/cache"
mkdir -p "$DEFAULT_PROJECT_DIR/reports"
echo "Created cache and reports subdirectories"

# Create current_project.json
CURRENT_PROJECT_FILE="$ATTACKTRACE_DIR/current_project.json"
if [ ! -f "$CURRENT_PROJECT_FILE" ]; then
    echo '{"projectId":"default"}' > "$CURRENT_PROJECT_FILE"
    echo "Created current_project.json with default project"
fi

echo ""
echo "======================================"
echo "Migration completed successfully!"
echo "======================================"
echo ""
echo "Summary:"
echo "  - Old files backed up to: $BACKUP_DIR"
echo "  - New files created in: $DEFAULT_PROJECT_DIR"
echo "  - Current project set to: default"
echo ""
echo "You can safely delete the old files if everything works correctly:"
echo "  rm -f $OLD_CONFIG"
echo "  rm -f $OLD_DB"
echo ""
