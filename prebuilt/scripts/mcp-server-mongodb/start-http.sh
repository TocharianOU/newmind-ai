#!/bin/bash

# MongoDB MCP Server - HTTP Streamable Mode Startup Script

echo "🚀 Starting MongoDB MCP Server (HTTP Streamable Mode)"
echo "======================================================"

# MongoDB Configuration (similar to MySQL)
export MONGODB_HOST="localhost"
export MONGODB_PORT="27017"
export MONGODB_USER="admin"
export MONGODB_PASS="123456"
# export MONGODB_DB="mydb"  # Optional: leave empty to access all databases
#export NODE_TLS_REJECT_UNAUTHORIZED="0"

# MCP Transport Configuration
export MCP_TRANSPORT="http"
export MCP_HTTP_PORT="3002"
export MCP_HTTP_HOST="localhost"

echo ""
echo "📋 Configuration:"
echo "   MongoDB Host: ${MONGODB_HOST}:${MONGODB_PORT}"
if [ -n "$MONGODB_DB" ]; then
  echo "   Database: ${MONGODB_DB}"
else
  echo "   Database: All databases (multi-DB mode)"
fi
echo "   HTTP Host: ${MCP_HTTP_HOST}"
echo "   HTTP Port: ${MCP_HTTP_PORT}"
echo ""
echo "🌐 Server will be available at:"
echo "   • MCP Endpoint: http://${MCP_HTTP_HOST}:${MCP_HTTP_PORT}/mcp"
echo "   • Health Check: http://${MCP_HTTP_HOST}:${MCP_HTTP_PORT}/health"
echo ""
echo "⏳ Starting server..."
echo ""

# Start the server
node index.js

