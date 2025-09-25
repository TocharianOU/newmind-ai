#!/bin/bash

# Build Docker image with current user
docker build -f docker/linux-tauri-build/Dockerfile \
  --build-arg USER_ID=$(id -u) \
  --build-arg GROUP_ID=$(id -g) \
  -t dive-builder .

# Create output directory
mkdir -p release/tauri

# Run container - directly mount output directory
docker run --rm \
  -v $(pwd):/app \
  dive-builder

chown -R $(id -u):$(id -g) ./