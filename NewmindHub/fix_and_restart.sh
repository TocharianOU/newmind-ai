#!/bin/bash

# Fix and Restart Script for NewmindHub
echo "🔧 Fixing MCP Server issues and restarting NewmindHub..."

# Navigate to NewmindHub directory
cd "$(dirname "$0")"

echo "📦 Installing dependencies..."
npm install

echo "🗄️ Generating Prisma client..."
npm run db:generate

echo "🔄 Pushing database schema changes..."
npm run db:push

echo "🌱 Running seed data..."
npm run db:seed

echo "✅ Database updated successfully!"

echo "🚀 Starting NewmindHub server..."
npm start
