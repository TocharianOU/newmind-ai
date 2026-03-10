#!/usr/bin/env node
// Wrapper for electron-builder that:
// 1. Cleans mcp-host/.venv (removes external symlinks that break asar)
// 2. Reads PRODUCT_NAME from .env and injects --config.productName
// Usage: node scripts/eb-run.cjs [electron-builder args...]

const { execSync } = require("child_process")
const path = require("path")
const fs = require("fs")

// Load .env from project root
require("dotenv").config({ path: path.join(__dirname, "..", ".env") })

// Clean .venv (contains external symlinks that violate asar integrity on macOS)
const venvPath = path.join(__dirname, "..", "mcp-host", ".venv")
if (fs.existsSync(venvPath)) {
  fs.rmSync(venvPath, { recursive: true, force: true })
  console.log("Cleaned mcp-host/.venv")
}

// Build electron-builder command with all passed args
const args = process.argv.slice(2)
const productName = process.env.PRODUCT_NAME

const cmd = ["electron-builder", ...args]
if (productName) {
  cmd.push(`--config.productName=${productName}`)
  console.log(`Using PRODUCT_NAME: ${productName}`)
}

execSync(cmd.join(" "), { stdio: "inherit" })
