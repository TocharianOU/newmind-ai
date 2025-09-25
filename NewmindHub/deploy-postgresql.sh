#!/bin/bash

echo "🚀 NewmindHub PostgreSQL Deployment Script"
echo "=========================================="

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "Please create .env file with PostgreSQL configuration:"
    echo "DATABASE_URL=\"postgresql://postgres:azmatjan1997A@xiaopenges.tocharian.eu:3307/newmind_hub?schema=public\""
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "🔄 Generating Prisma Client..."
npx prisma generate

echo "📊 Creating database schema..."
npx prisma db push --accept-data-loss

echo "🌱 Seeding initial data..."
node prisma/seed.js

echo "✅ PostgreSQL deployment completed!"
echo ""
echo "📝 Next steps:"
echo "1. Start the server: npm start"
echo "2. Test login with test accounts:"
echo "   - base@test.com / password123"
echo "   - pro@test.com / password123"
echo "   - enterprise@test.com / password123"
echo ""
echo "🔧 Important: Update JWT_SECRET and ANTHROPIC_API_KEY in .env file!"
