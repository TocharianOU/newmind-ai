#!/bin/bash

echo "Starting AttackTrace Documentation Server..."
echo "Building Docker image and starting container..."
docker-compose up --build

echo ""
echo "Documentation will be available at: http://localhost:8002"

