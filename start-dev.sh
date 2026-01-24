#!/bin/bash

# Start Development Environment Script
echo "🚀 Starting NewmindHub Development Environment..."

# Check if .env files exist, if not create them
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from example..."
    cp env.example .env
    echo "⚠️  Please update .env file with your configuration"
fi

if [ ! -f "NewmindHub/.env" ]; then
    echo "📝 Creating NewmindHub/.env file from example..."
    cp NewmindHub/env.example NewmindHub/.env
    echo "⚠️  Please update NewmindHub/.env file with your configuration"
fi

if [ ! -f "NewmindHub/frontend/.env" ]; then
    echo "📝 Creating NewmindHub/frontend/.env file from example..."
    cp NewmindHub/frontend/env.example NewmindHub/frontend/.env
    echo "⚠️  Please update NewmindHub/frontend/.env file with your configuration"
fi

echo "🔧 Setting up database..."
cd NewmindHub
npm run db:generate
npm run db:push
npm run db:seed

echo "✅ Environment setup complete!"
echo ""
echo "📋 To start the services:"
echo "1. Backend: cd NewmindHub && npm run dev"
echo "2. Frontend: cd NewmindHub/frontend && npm run dev"
echo "3. Dive App: npm run dev"
echo ""
echo "🌐 URLs:"
echo "- Backend API: http://localhost:3000"
echo "- Hub Frontend: http://localhost:5174"
echo "- Dive App: http://localhost:7777"
