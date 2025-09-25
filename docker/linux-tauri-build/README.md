# Tauri Linux Build Environment

This Docker image provides a complete build environment for Tauri applications with support for **AppImage**, **DEB**, and **RPM** packages. Files are created with your current user permissions to avoid root ownership issues.

The container automatically executes the build process when started.

## 🚀 Quick Start

### Build the Docker Image with Your User

```bash
# Build with your current user ID and group ID
docker build -f docker/linux-tauri-build/Dockerfile \
  --build-arg USER_ID=$(id -u) \
  --build-arg GROUP_ID=$(id -g) \
  --build-arg USERNAME=$(whoami) \
  -t dive-builder .
```

### Run Build (Automatic Execution)

```bash
# Container will automatically run build.sh, output directly to mounted directory
docker run --rm \
  -v $(pwd):/app \
  -v $(pwd)/dist:/app/output \
  dive-builder
```

### Simple One-liner

```bash
# Complete build process - container executes build automatically
docker run --rm -v $(pwd):/app dive-builder
```

### Using the Convenience Script

```bash
# Use the included build script
./scripts/docker/build-linux-tauri.sh
```

## 📦 Output Formats

- **`.deb`** - Debian/Ubuntu packages
- **`.rpm`** - RedHat/Fedora/CentOS packages
- **`.AppImage`** - Universal Linux executables

## 🔧 Usage Examples

### Output to Custom Directory

```bash
# Mount custom output directory
docker run --rm \
  -v $(pwd):/app \
  -v /path/to/output:/app/output \
  dive-builder
```

### Interactive Mode (for debugging)

```bash
# Override default command to get shell access
docker run -it --rm -v $(pwd):/app dive-builder /bin/bash

# Inside container, run build manually
~/build.sh

# Check output (files will have your user permissions)
ls -la /app/output/
```

### Build with Different User (if needed)

```bash
# Build image with specific user ID
docker build -f docker/linux-tauri-build/Dockerfile \
  --build-arg USER_ID=1001 \
  --build-arg GROUP_ID=1001 \
  --build-arg USERNAME=myuser \
  -t dive-builder-custom .

# Run with that user (automatic build)
docker run --rm -v $(pwd):/app -v $(pwd)/dist:/app/output dive-builder-custom
```

## 🐛 Debugging

### Check Build Process with Verbose Output

```bash
# Run with verbose output
docker run --rm -v $(pwd):/app dive-builder sh -c "set -x && /home/$(whoami)/build.sh"
```

### Manual Build Steps

```bash
# Run container interactively to debug step by step
docker run -it --rm -v $(pwd):/app dive-builder /bin/bash

# Check user and permissions
whoami
id
ls -la ~

# Check installed tools
node --version
cargo --version
tauri --version

# Run build manually
~/build.sh
```

### File Permissions Check

```bash
# Check output file permissions (should match your user)
docker run --rm -v $(pwd):/app -v $(pwd)/test-output:/app/output dive-builder
ls -la test-output/
```

## 📋 System Requirements

- Docker 19.03+
- At least 4GB available disk space
- At least 2GB RAM (4GB+ recommended)

## ⚡ Performance Tips

### Use BuildKit

```bash
# Enable BuildKit for faster builds
DOCKER_BUILDKIT=1 docker build -f docker/linux-tauri-build/Dockerfile \
  --build-arg USER_ID=$(id -u) \
  --build-arg GROUP_ID=$(id -g) \
  --build-arg USERNAME=$(whoami) \
  -t dive-builder .
```

### Complete Build Script

The included `scripts/docker/build-linux-tauri.sh` script handles everything:

```bash
#!/bin/bash

# Build Docker image with current user
docker build -f docker/linux-tauri-build/Dockerfile \
  --build-arg USER_ID=$(id -u) \
  --build-arg GROUP_ID=$(id -g) \
  --build-arg USERNAME=$(whoami) \
  -t dive-builder .

# Create output directory
mkdir -p release/tauri

# Run container - directly mount output directory
docker run --rm \
  -v $(pwd):/app \
  -v $(pwd)/release/tauri:/app/output \
  dive-builder
```

## 🔒 Security Notes

- Files created will have your current user permissions
- Container runs with your UID/GID to match file permissions
- The container automatically executes build.sh when started (override with `/bin/bash` for interactive mode)
- Output is directly mounted to host filesystem, no copying required