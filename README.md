# Newmind Agent 🧠 🤖

![GitHub stars](https://img.shields.io/github/stars/TocharianOU/newmind-ai?style=social)
![GitHub forks](https://img.shields.io/github/forks/TocharianOU/newmind-ai?style=social)
![GitHub watchers](https://img.shields.io/github/watchers/TocharianOU/newmind-ai?style=social)
![GitHub repo size](https://img.shields.io/github/repo-size/TocharianOU/newmind-ai)
![GitHub language count](https://img.shields.io/github/languages/count/TocharianOU/newmind-ai)
![GitHub top language](https://img.shields.io/github/languages/top/TocharianOU/newmind-ai)
![GitHub last commit](https://img.shields.io/github/last-commit/TocharianOU/newmind-ai?color=red)

Newmind Agent is an open-source MCP Host Desktop Application that seamlessly integrates with any LLMs supporting function calling capabilities. ✨

## Features 🎯

- 🌐 **Universal LLM Support**: Compatible with ChatGPT, Anthropic, Ollama and OpenAI-compatible models
- 💻 **Cross-Platform**: Available for Windows, MacOS, and Linux
- 🔄 **Model Context Protocol**: Enabling seamless MCP AI agent integration on both stdio and SSE mode
- ☁️ **OAP Cloud Integration**: One-click access to managed MCP servers via [OAPHub.ai](https://oaphub.ai/) - eliminates complex local deployments
- 🏗️ **Dual Architecture**: Modern Tauri version alongside traditional Electron version for optimal performance
- 🌍 **Multi-Language Support**: Simplified Chinese and English
- ⚙️ **Advanced API Management**: Multiple API keys and model switching support with `model_settings.json`
- 🛠️ **Granular Tool Control**: Enable/disable individual MCP tools for precise customization
- 💡 **Custom Instructions**: Personalized system prompts for tailored AI behavior
- 🔄 **Auto-Update Mechanism**: Automatically checks for and installs the latest application updates

## Recent updates - v0.0.1 🎉

### Major Architecture Changes
- 🏗️ **Dual Architecture Support**: Newmind Agent now supports both **Electron** and **Tauri** frameworks simultaneously
- ⚡ **Tauri Version**: New modern architecture with optimized installer size (Windows < 30MB)
- 🌐 **OAP Platform Integration**: Native support for [OAPHub.ai](https://oaphub.ai/) cloud services with one-click MCP server deployment

### New Features & Improvements
- 🔐 **OAP Authentication**: Comprehensive OAP login and authentication support
- 📁 **Enhanced Model Configuration**: Complete restructuring with `model_settings.json` for managing multiple models
- 🛠️ **Granular MCP Control**: Individual tool enable/disable functionality for better customization
- 🎨 **UI/UX Enhancements**: Streamlined settings interface with combined pages for better user experience
- 🔧 **Improved Network Handling**: Enhanced port resolution logic with interval polling for better connectivity
- ⚙️ **Enhanced Model Settings**: Improved OpenAI compatible model settings and tool integration in prompts
- 🐧 **Linux Tauri Support**: Full Tauri framework support now available on Linux platforms
- 📦 **Smart Dependency Management**: Automatic detection and updating of MCP host dependencies
- 🔄 **Updated mcp-host**: Latest architectural improvements incorporated

### Platform Availability
- **Windows**: Available in both Electron and Tauri versions ✅
- **macOS**: Currently Electron only 🔜
- **Linux**: Available in both Electron and Tauri versions ✅

> **Migration Note:** Existing local MCP/LLM configurations remain fully supported. OAP integration is additive and does not affect current workflows.

## Download and Install ⬇️

Get the latest version of Newmind Agent:
[![Download](https://img.shields.io/badge/Download-Latest%20Release-blue.svg)](https://github.com/TocharianOU/newmind-ai/releases/latest)

### Windows users: 🪟
Choose between two architectures:
- **Tauri Version** (Recommended): Smaller installer (<30MB), modern architecture
- **Electron Version**: Traditional architecture, fully stable
- Python and Node.js environments will be downloaded automatically after launching

### MacOS users: 🍎
- **Electron Version**: Download the .dmg version
- You need to install Python and Node.js (with npx uvx) environments yourself
- Follow the installation prompts to complete setup

### Linux users: 🐧
Choose between two architectures:
- **Tauri Version** (Recommended): Modern architecture with smaller installer size
- **Electron Version**: Traditional architecture with .AppImage format
- You need to install Python and Node.js (with npx uvx) environments yourself
- For Ubuntu/Debian users:
  - You may need to add `--no-sandbox` parameter
  - Or modify system settings to allow sandbox
  - Run `chmod +x` to make the AppImage executable

## MCP Setup Options

Newmind Agent offers two ways to access MCP tools: **OAP Cloud Services** (recommended for beginners) and **Local MCP Servers** (for advanced users).

### Option 1: Local MCP Servers 🛠️

For advanced users who prefer local control. The system comes with a default echo MCP Server, and you can add more powerful tools like Fetch and Youtube-dl.

### Option 2: OAP Cloud Services ☁️

The easiest way to get started! Access enterprise-grade MCP tools instantly:

1. **Sign up** at [OAPHub.ai](https://oaphub.ai/)
2. **Connect** to Newmind Agent using one-click deep links or configuration files
3. **Enjoy** managed MCP servers with zero setup - no Python, Docker, or complex dependencies required

Benefits:
- ✅ Zero configuration needed
- ✅ Cross-platform compatibility
- ✅ Enterprise-grade reliability
- ✅ Automatic updates and maintenance

#### Quick Local Setup

Add this JSON configuration to your Newmind Agent MCP settings to enable local tools:

```json
 "mcpServers":{
    "fetch": {
      "command": "uvx",
      "args": [
        "mcp-server-fetch",
        "--ignore-robots-txt"
      ],
      "enabled": true
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/path/to/allowed/files"
      ],
      "enabled": true
    },
    "youtubedl": {
      "command": "npx",
      "args": [
        "@kevinwatt/yt-dlp-mcp"
      ],
      "enabled": true
    }
  }
```

#### Using Streamable HTTP for Cloud MCP Services

You can connect to external cloud MCP servers via Streamable HTTP transport. Here's the Newmind Agent configuration example for SearXNG service from OAPHub:

```json
{
  "mcpServers": {
    "SearXNG_MCP_Server": {
      "transport": "streamable",
      "url": "https://proxy.oaphub.ai/v1/mcp/181672830075666436",
      "headers": {
        "Authorization": "GLOBAL_CLIENT_TOKEN"
      }
    }
  }
}
```

Reference: [@https://oaphub.ai/mcp/181672830075666436](https://oaphub.ai/mcp/181672830075666436)

#### Using SSE Server (Non-Local MCP)

You can also connect to external MCP servers (not local ones) via SSE (Server-Sent Events). Add this configuration to your Newmind Agent MCP settings:

```json
{
  "mcpServers": {
    "MCP_SERVER_NAME": {
      "enabled": true,
      "transport": "sse",
      "url": "YOUR_SSE_SERVER_URL"
    }
  }
}
```

#### Additional Setup for yt-dlp-mcp

yt-dlp-mcp requires the yt-dlp package. Install it based on your operating system:

#### Windows
```bash
winget install yt-dlp
```

#### MacOS
```bash
brew install yt-dlp
```

#### Linux
```bash
pip install yt-dlp
```

## Build 🛠️

See [BUILD.md](BUILD.md) for more details.

## Connect With Us 🌐
- ⭐ Star us on GitHub
- 🐛 Report issues on our [Issue Tracker](https://github.com/TocharianOU/newmind-ai/issues)