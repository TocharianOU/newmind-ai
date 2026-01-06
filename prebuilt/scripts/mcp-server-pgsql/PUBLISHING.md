# Publishing Guide for PostgreSQL MCP Server

## 🚀 Publishing to npm

### Prerequisites

1. **npm account**: Create an account at [npmjs.com](https://npmjs.com)
2. **Update package.json**: Replace placeholders with your actual information:
   ```json
   {
     "name": "@your-username/postgres-mcp-server",
     "author": {
       "name": "Your Name",
       "email": "your.email@example.com",
       "url": "https://github.com/your-username"
     },
     "repository": {
       "type": "git",
       "url": "git+https://github.com/your-username/postgres-mcp-server.git"
     }
   }
   ```

### Step-by-Step Publishing

1. **Login to npm**:
   ```bash
   npm login
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```

3. **Test the package locally** (optional):
   ```bash
   npm pack
   # This creates a .tgz file you can test with: npm install ./package.tgz
   ```

4. **Publish to npm**:
   ```bash
   npm publish --access public
   ```

   > **Note**: Use `--access public` for scoped packages (@your-username/package-name)

### Alternative: Unscoped Publishing

If you prefer an unscoped package name (easier for users), change the package name to:
```json
{
  "name": "postgres-mcp-server-cli",  // or another unique name
}
```

Then publish with:
```bash
npm publish
```

## 📦 Usage After Publishing

### Global Installation

Users can install globally and run from anywhere:

```bash
# Install globally
npm install -g @your-username/postgres-mcp-server

# Run from anywhere
postgres-mcp --connection-string "postgresql://user:pass@localhost:5432/db"
```

### Using with npx (No Installation)

Users can run directly without installing:

```bash
npx @your-username/postgres-mcp-server --connection-string "postgresql://user:pass@localhost:5432/db"
```

### MCP Client Configuration

After publishing, users can configure their MCP clients:

```json
{
  "mcpServers": {
    "postgresql-mcp": {
      "command": "npx",
      "args": [
        "@your-username/postgres-mcp-server",
        "--connection-string", "postgresql://user:password@host:port/database"
      ]
    }
  }
}
```

Or with global installation:
```json
{
  "mcpServers": {
    "postgresql-mcp": {
      "command": "postgres-mcp",
      "args": [
        "--connection-string", "postgresql://user:password@host:port/database"
      ]
    }
  }
}
```

## 🔄 Updating the Package

### Version Management

Update version in package.json and publish:

```bash
# Patch version (1.0.0 -> 1.0.1)
npm version patch

# Minor version (1.0.0 -> 1.1.0)
npm version minor

# Major version (1.0.0 -> 2.0.0)
npm version major

# Then publish
npm publish
```

### Automated Publishing with GitHub Actions

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      
      - run: npm ci
      - run: npm run build
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## 🧪 Testing the Package

### Local Testing

Test the built package locally:

```bash
# Build
npm run build

# Test CLI directly
node build/index.js --help

# Test with sample connection (use your actual DB)
node build/index.js --connection-string "postgresql://localhost/test"
```

### Test with MCP Client

1. **Install locally in test project**:
   ```bash
   npm pack
   npm install -g ./postgres-mcp-server-1.0.0.tgz
   ```

2. **Configure MCP client** and test tools

3. **Uninstall test version**:
   ```bash
   npm uninstall -g @your-username/postgres-mcp-server
   ```

## 📋 Checklist Before Publishing

- [ ] Update `package.json` with your details
- [ ] Ensure all placeholder names are replaced
- [ ] Build succeeds without errors: `npm run build`
- [ ] CLI works: `node build/index.js --help`
- [ ] All dependencies are correct
- [ ] README.md is updated
- [ ] License is appropriate
- [ ] Version number is correct

## 🚨 Security Considerations

1. **Never commit connection strings** to git
2. **Review dependencies** for security vulnerabilities:
   ```bash
   npm audit
   npm audit fix
   ```
3. **Use environment variables** for sensitive data
4. **Consider scoped packages** for namespace control

## 📈 Post-Publication

### Monitor Usage

- Check npm statistics: `npm view @your-username/postgres-mcp-server`
- Monitor downloads and issues
- Update documentation based on user feedback

### Maintenance

- Keep dependencies updated
- Respond to GitHub issues
- Follow semantic versioning for updates
- Consider setting up automated security updates

## 🔗 Useful Commands

```bash
# Check what will be published
npm pack --dry-run

# View published package info
npm view @your-username/postgres-mcp-server

# Check package size
npm pack && du -h *.tgz

# Test installation
npm install -g @your-username/postgres-mcp-server

# Uninstall
npm uninstall -g @your-username/postgres-mcp-server
```

Happy publishing! 🎉 