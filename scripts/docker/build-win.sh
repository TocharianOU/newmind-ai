#!/bin/bash

# Load .env from project root and pass VITE_* / PRODUCT_NAME vars into Docker
ENV_ARGS=""
ENV_FILE="$(cd "$(dirname "$0")/../.." && pwd)/.env"
if [ -f "$ENV_FILE" ]; then
  while IFS= read -r line; do
    # Skip comments and empty lines
    [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
    ENV_ARGS="$ENV_ARGS -e $line"
  done < "$ENV_FILE"
fi

echo "Building Docker image..."
docker build \
  -f docker/win-build/Dockerfile \
  -t dive-builder-win:latest .

echo "Building Windows executable..."
docker run --rm \
  -v ${PWD}/release:/app/release \
  $ENV_ARGS \
  dive-builder-win:latest

echo "Build complete! Check the release folder for output."
