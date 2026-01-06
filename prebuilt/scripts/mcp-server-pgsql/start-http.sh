#!/bin/bash

# PostgreSQL MCP Server - HTTP Streamable Mode Startup Script

echo "🚀 Starting PostgreSQL MCP Server (HTTP Streamable Mode)"
echo "========================================================"

# PostgreSQL Configuration (similar to MySQL)
export POSTGRES_HOST="localhost"
export POSTGRES_PORT="5432"
export POSTGRES_USER="myuser"
export POSTGRES_PASS="123456"
# export POSTGRES_DB="mydb"  # Optional: leave empty to access all databases
#export NODE_TLS_REJECT_UNAUTHORIZED="0"

# MCP Transport Configuration
export MCP_TRANSPORT="http"
export MCP_HTTP_PORT="3001"
export MCP_HTTP_HOST="0.0.0.0"

echo ""
echo "📋 Configuration:"
echo "   PostgreSQL Host: ${POSTGRES_HOST}:${POSTGRES_PORT}"
if [ -n "$POSTGRES_DB" ]; then
  echo "   Database: ${POSTGRES_DB}"
else
  echo "   Database: postgres (multi-DB mode)"
fi
echo "   HTTP Host: ${MCP_HTTP_HOST}"
echo "   HTTP Port: ${MCP_HTTP_PORT}"
echo ""
echo "🌐 Server will be available at:"
echo "   • MCP Endpoint: http://${MCP_HTTP_HOST}:${MCP_HTTP_PORT}/mcp"
echo "   • Health Check: http://${MCP_HTTP_HOST}:${MCP_HTTP_PORT}/health"
echo ""
echo "⏳ Starting server (will test database connection first)..."

# Start the server (using local build)
node build/index.js







