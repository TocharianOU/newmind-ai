# NewmindChat Documentation

Official user documentation for NewmindChat desktop application.

## About

This documentation covers:

- Installation and setup
- Hub features (models and MCP marketplace)
- Local MCP server configuration
- Troubleshooting and support

## Local Development

### Prerequisites

- Python 3.8+
- uv (Python package manager)

### Install Dependencies

```bash
uv pip install -r requirements.txt
```

### Run Locally

```bash
uv run mkdocs serve -a 0.0.0.0:8002
```

Visit: http://localhost:8002

### Build

```bash
mkdocs build
```

Output will be in `site/` directory.

## Docker

### Using Docker Compose

```bash
docker-compose up
```

Visit: http://localhost:8002

### Build Docker Image

```bash
docker build -t newmindchat-docs .
```

### Run Container

```bash
docker run -p 8002:8002 newmindchat-docs
```

## Documentation Structure

```
docs/
├── index.md                    # Home page
├── getting-started/            # Installation and first steps
│   ├── download.md
│   ├── installation.md
│   └── first-chat.md
├── hub/                        # Hub features
│   ├── login.md
│   ├── models.md
│   ├── mcp-marketplace.md
│   └── subscription.md
├── features/                   # Application features
│   ├── chat.md
│   ├── models.md
│   ├── mcp-tools.md
│   └── history.md
├── mcp-servers/                # MCP server configuration
│   ├── echo.md
│   ├── kibana.md
│   ├── elasticsearch.md
│   └── custom.md
├── configuration/              # Configuration guides
│   ├── mcp-config.md
│   ├── model-config.md
│   └── settings.md
├── troubleshooting/            # Problem solving
│   ├── common-issues.md
│   ├── connection-errors.md
│   └── logs.md
└── zh/                         # Chinese version
    └── (mirrors English structure)
```

## Contributing

Documentation improvements are welcome! Please ensure:

1. Content is clear and accurate
2. Examples are tested
3. Both English and Chinese versions are updated
4. Markdown formatting is consistent

## Download NewmindChat

Get the latest version at: [http://xiaopenges.tocharian.eu:23001/](http://xiaopenges.tocharian.eu:23001/)

## License

This documentation is part of the NewmindChat project.
