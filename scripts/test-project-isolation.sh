#!/bin/bash

# Test script to verify project-based database isolation
# This script helps verify that different projects use different SQLite databases

set -e

ATTACKTRACE_DIR="$HOME/.attacktrace"
PROJECTS_DIR="$ATTACKTRACE_DIR/projects"
CONFIG_DIR="$ATTACKTRACE_DIR/config"

echo "=========================================="
echo "AttackTrace Project Isolation Test"
echo "=========================================="
echo ""

# Check if projects directory exists
if [ ! -d "$PROJECTS_DIR" ]; then
    echo "❌ Projects directory not found: $PROJECTS_DIR"
    echo "   Please run AttackTrace at least once to initialize"
    exit 1
fi

echo "✓ Projects directory found: $PROJECTS_DIR"
echo ""

# List all projects
echo "📁 Existing Projects:"
echo "-------------------------------------------"
for project_dir in "$PROJECTS_DIR"/*; do
    if [ -d "$project_dir" ]; then
        project_name=$(basename "$project_dir")
        db_file="$project_dir/db.sqlite"
        config_file="$project_dir/mcp_config.json"
        
        echo ""
        echo "  Project: $project_name"
        
        if [ -f "$db_file" ]; then
            db_size=$(du -h "$db_file" | cut -f1)
            echo "  ├─ Database: ✓ ($db_size)"
            
            # Count tables in database (requires sqlite3)
            if command -v sqlite3 &> /dev/null; then
                table_count=$(sqlite3 "$db_file" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "N/A")
                echo "  │  └─ Tables: $table_count"
                
                # Count chat sessions (if tables exist)
                chat_count=$(sqlite3 "$db_file" "SELECT COUNT(*) FROM chats;" 2>/dev/null || echo "N/A")
                if [ "$chat_count" != "N/A" ]; then
                    echo "  │     └─ Chat sessions: $chat_count"
                fi
            fi
        else
            echo "  ├─ Database: ✗ (not created yet)"
        fi
        
        if [ -f "$config_file" ]; then
            echo "  └─ MCP Config: ✓"
        else
            echo "  └─ MCP Config: ✗"
        fi
    fi
done

echo ""
echo "-------------------------------------------"
echo ""

# Check current project
CURRENT_PROJECT_FILE="$ATTACKTRACE_DIR/current_project.json"
if [ -f "$CURRENT_PROJECT_FILE" ]; then
    current_project=$(cat "$CURRENT_PROJECT_FILE" | grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
    echo "📌 Current Active Project: $current_project"
else
    echo "⚠️  No current project set (will use 'default')"
fi

echo ""

# Check legacy database
LEGACY_DB="$CONFIG_DIR/db.sqlite"
if [ -f "$LEGACY_DB" ]; then
    legacy_size=$(du -h "$LEGACY_DB" | cut -f1)
    echo "⚠️  Legacy database still exists: $LEGACY_DB ($legacy_size)"
    echo "   This file is no longer used. A backup has been created during migration."
    echo "   You can safely delete it after verifying your data is intact."
fi

echo ""
echo "=========================================="
echo "✓ Project isolation check complete"
echo "=========================================="
echo ""
echo "To verify isolation works:"
echo "1. Open AttackTrace and note your current project"
echo "2. Create some chat sessions"
echo "3. Switch to a different project"
echo "4. Verify chat sessions are different"
echo "5. Run this script again to see database sizes"
echo ""
