#!/usr/bin/env node

import { join, dirname, extname, resolve } from 'path'
import stripJsonComments from 'strip-json-comments'
import { readFile, writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const run = async () => {
  const homeDir = process.env.HOME || process.env.USERPROFILE

  let configPath = process.env.CONFIG_PATH || join(homeDir, '.mongodb-lens.jsonc')

  if (!extname(configPath)) configPath = join(configPath, '.mongodb-lens.jsonc')

  if (!configPath.endsWith('.json') && !configPath.endsWith('.jsonc')) {
    console.error('Error: Configuration file must have .json or .jsonc extension')
    process.exit(1)
  }

  configPath = resolve(configPath)

  try {
    const configContent = await extractConfigFromReadme()

    if (existsSync(configPath)) {
      const overwrite = process.argv.includes('--force')
      if (!overwrite) {
        console.log(`Configuration file already exists at: ${configPath}`)
        console.log('Use --force to overwrite it.')
        return
      }
      console.log(`Overwriting existing configuration file at: ${configPath}`)
    }

    let finalContent = configContent
    if (configPath.endsWith('.json')) finalContent = stripJsonComments(configContent)

    finalContent = finalContent
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n')

    await writeFile(configPath, finalContent, 'utf8')
    console.log(`Configuration file created successfully at: ${configPath}`)
  } catch (error) {
    console.error('Error creating configuration file:', error.message)
    process.exit(1)
  }
}

const extractConfigFromReadme = async () => {
  try {
    const possiblePaths = [
      join(__dirname, 'README.md'),
      join(__dirname, '..', 'README.md'),
      join(process.cwd(), 'README.md')
    ]

    let readmeContent = null

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        readmeContent = await readFile(path, 'utf8')
        console.log(`Found README at: ${path}`)
        break
      }
    }

    if (!readmeContent) throw new Error('README.md not found in expected locations')

    const configRegex = /Example configuration file[\s\S]*?```jsonc\s*([\s\S]*?)```/
    const match = readmeContent.match(configRegex)

    if (!match || !match[1]) throw new Error('Could not find example configuration in README.md')

    return match[1].trim()
  } catch (error) {
    console.error('Error extracting configuration from README:', error.message)
    throw error
  }
}

run()
