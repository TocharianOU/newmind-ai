// Template for creating new MCP integrations
// Copy this folder and modify the config to add a new integration

export default {
  name: 'YourIntegrationName',
  version: '1.0.0',
  downloadUrl: 'https://github.com/username/repo/releases/download/v1.0.0/package.tar.gz',
  
  description: 'Short description of your integration',
  descriptionI18n: {
    en: 'English description',
    zh: '中文描述'
  },
  
  tags: ['Category1', 'Category2'],
  
  transport: 'stdio',  // or 'sse', 'streamable', 'websocket'
  command: 'node',     // or 'python', 'npx', etc.
  args: ['{{install_path}}/dist/index.js'],  // {{install_path}} is auto-replaced
  env: {
    // Environment variables that users will configure
    API_URL: '',
    API_KEY: '',
  },
  
  planRequired: 'BASE',  // or 'PRO', 'ENTERPRISE'
  banner: 'https://example.com/logo.svg',
  
  document: `# Your Integration Name

Documentation content in markdown format.

## Features
- Feature 1
- Feature 2

## Configuration
Describe how to configure the integration.`,
  
  documentI18n: {
    en: `English documentation`,
    zh: `中文文档`
  },
  
  // JSON Schema for configuration form
  configSchema: {
    type: 'object',
    required: ['url'],  // Required fields
    properties: {
      url: {
        type: 'string',
        title: 'Service URL',
        description: 'The endpoint URL for your service',
        format: 'uri'
      },
      apiKey: {
        type: 'string',
        title: 'API Key',
        description: 'Your API key',
        sensitive: true  // Will be masked in UI
      },
      // File upload example
      certificate: {
        type: 'string',
        title: 'Certificate',
        description: 'Upload certificate file',
        format: 'file'
      },
      // Number with validation
      timeout: {
        type: 'number',
        title: 'Timeout',
        description: 'Request timeout in ms',
        default: 5000,
        minimum: 1000,
        maximum: 60000
      },
      // Boolean/switch
      enableDebug: {
        type: 'boolean',
        title: 'Enable Debug Mode',
        default: false
      },
      // Select/dropdown
      region: {
        type: 'string',
        title: 'Region',
        enum: ['us-east-1', 'us-west-2', 'eu-west-1']
      }
    },
    // Multiple authentication modes example (optional)
    oneOf: [
      {
        required: ['url', 'apiKey'],
        title: 'API Key Authentication'
      },
      {
        required: ['url', 'username', 'password'],
        title: 'Basic Authentication',
        properties: {
          username: { type: 'string', title: 'Username' },
          password: { type: 'string', title: 'Password', sensitive: true }
        }
      }
    ]
  },
  
  toolTier: 'X',        // 'A' | 'B' | 'C' | 'X' — internal tier for cost classification
  unitPriceUsd: 0,      // USD charged per call from user's balance (0 = BYOK / no platform charge)
  popular: false,
  new: true,
  isActive: true
}
