#!/bin/bash

# AttackTrace - Clean All Local Data
# Usage: ./scripts/clean.sh

set -e

echo "======================================"
echo "AttackTrace - Clean All Data"
echo "======================================"
echo ""

# Get home directory
HOME_DIR="$HOME"
ATTACKTRACE_DIR="$HOME_DIR/.attacktrace"

# Check if directory exists
if [ ! -d "$ATTACKTRACE_DIR" ]; then
  echo "✓ No data found at $ATTACKTRACE_DIR"
  exit 0
fi

# Create backup timestamp
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$HOME_DIR/.attacktrace_backup_$BACKUP_TIMESTAMP"

echo "Creating backup at: $BACKUP_DIR"
cp -r "$ATTACKTRACE_DIR" "$BACKUP_DIR" 2>/dev/null || true
echo "✓ Backup created"

echo ""
echo "Removing data directories..."

# Remove projects directory
if [ -d "$ATTACKTRACE_DIR/projects" ]; then
  echo "  - Removing projects/"
  rm -rf "$ATTACKTRACE_DIR/projects"
fi

# Remove cache directories
if [ -d "$ATTACKTRACE_DIR/host_cache" ]; then
  echo "  - Removing host_cache/"
  rm -rf "$ATTACKTRACE_DIR/host_cache"
fi

# Remove logs
if [ -d "$ATTACKTRACE_DIR/log" ]; then
  echo "  - Removing log/"
  rm -rf "$ATTACKTRACE_DIR/log"
fi

# Remove scripts
if [ -d "$ATTACKTRACE_DIR/scripts" ]; then
  echo "  - Removing scripts/"
  rm -rf "$ATTACKTRACE_DIR/scripts"
fi

# Remove mcp-packages
if [ -d "$ATTACKTRACE_DIR/mcp-packages" ]; then
  echo "  - Removing mcp-packages/"
  rm -rf "$ATTACKTRACE_DIR/mcp-packages"
fi

# Remove config files
if [ -f "$ATTACKTRACE_DIR/current_project.json" ]; then
  echo "  - Removing current_project.json"
  rm -f "$ATTACKTRACE_DIR/current_project.json"
fi

if [ -d "$ATTACKTRACE_DIR/config" ]; then
  echo "  - Removing config/"
  rm -rf "$ATTACKTRACE_DIR/config"
fi

echo ""
echo "======================================"
echo "✓ Cleanup completed!"
echo "======================================"
echo ""
echo "Backup saved at: $BACKUP_DIR"
echo ""
echo "The app will start fresh on next launch."
echo "To restore data, copy contents from backup directory:"
echo "  cp -r $BACKUP_DIR/* $ATTACKTRACE_DIR/"
echo ""
