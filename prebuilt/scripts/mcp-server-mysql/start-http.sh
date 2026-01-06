#!/bin/bash

# MySQL MCP Server - HTTP Streamable Mode Startup Script
# This script starts the MySQL MCP Server in HTTP mode

echo "🚀 Starting MySQL MCP Server (HTTP Streamable Mode)"
echo "===================================================="

# MySQL Configuration
export MYSQL_HOST="${MYSQL_HOST:-localhost}"
export MYSQL_PORT="${MYSQL_PORT:-3306}"
export MYSQL_USER="${MYSQL_USER:-root}"
export MYSQL_PASS="${MYSQL_PASS:-}"
export MYSQL_DB="${MYSQL_DB:-}"

# MySQL Connection Options
#export MYSQL_SOCKET_PATH="/tmp/mysql.sock"  # Uncomment for Unix socket connection
#export MYSQL_SSL="true"                      # Uncomment to enable SSL

# MCP Transport Configuration
export MCP_TRANSPORT="http"
export MCP_HTTP_PORT="${MCP_HTTP_PORT:-3000}"
export MCP_HTTP_HOST="${MCP_HTTP_HOST:-0.0.0.0}"

# Operation Permissions (set to true to enable write operations)
export ALLOW_INSERT_OPERATION="${ALLOW_INSERT_OPERATION:-false}"
export ALLOW_UPDATE_OPERATION="${ALLOW_UPDATE_OPERATION:-false}"
export ALLOW_DELETE_OPERATION="${ALLOW_DELETE_OPERATION:-false}"
export ALLOW_DDL_OPERATION="${ALLOW_DDL_OPERATION:-false}"

# Multi-DB Mode (omit MYSQL_DB to enable multi-database mode)
#export MULTI_DB_WRITE_MODE="false"

echo ""
echo "📋 Configuration:"
echo "   MySQL Host: ${MYSQL_HOST}"
echo "   MySQL Port: ${MYSQL_PORT}"
echo "   MySQL User: ${MYSQL_USER}"
echo "   MySQL DB: ${MYSQL_DB:-MULTI-DB MODE}"
echo "   HTTP Host: ${MCP_HTTP_HOST}"
echo "   HTTP Port: ${MCP_HTTP_PORT}"
echo ""
echo "⚙️  Permissions:"
echo "   INSERT: ${ALLOW_INSERT_OPERATION}"
echo "   UPDATE: ${ALLOW_UPDATE_OPERATION}"
echo "   DELETE: ${ALLOW_DELETE_OPERATION}"
echo "   DDL: ${ALLOW_DDL_OPERATION}"
echo ""
echo "🌐 Server will be available at:"
echo "   • MCP Endpoint: http://${MCP_HTTP_HOST}:${MCP_HTTP_PORT}/mcp"
echo "   • Health Check: http://${MCP_HTTP_HOST}:${MCP_HTTP_PORT}/health"
echo ""
echo "⏳ Starting server..."
echo ""

# Start the server (using local build for faster startup)
node dist/index.js





















