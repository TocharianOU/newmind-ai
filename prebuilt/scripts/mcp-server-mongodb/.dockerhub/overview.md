# MongoDB Lens

[![Docker Pulls](https://img.shields.io/docker/pulls/furey/mongodb-lens)](https://hub.docker.com/r/furey/mongodb-lens)<br>
[![Docker Image Size (latest by date)](https://img.shields.io/docker/image-size/furey/mongodb-lens)](https://hub.docker.com/r/furey/mongodb-lens)<br>
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-donate-orange.svg)](https://www.buymeacoffee.com/furey)

- [Overview](#overview)
- [Features](#features)
- [Usage](#usage)
- [Links](#links)
- [Disclaimer](#disclaimer)
- [Support](#support)

## Overview

<strong>MongoDB Lens</strong> is a Model Context Protocol (MCP) server providing full-featured MongoDB database access to LLMs like Claude. It enables natural language interaction with MongoDB databases for querying, aggregation, performance optimization, schema analysis, and more.

## Features

See: [GitHub Documentation → Features](https://github.com/furey/mongodb-lens?tab=readme-ov-file#features)

## Usage

```bash
# Basic usage with local MongoDB
docker run --rm -i --network=host furey/mongodb-lens

# With custom connection string
docker run --rm -i --network=host furey/mongodb-lens mongodb://username:password@hostname:27017/database

# With verbose logging
docker run --rm -i --network=host -e CONFIG_LOG_LEVEL='verbose' furey/mongodb-lens
```

## Links

- [NPM Package](https://www.npmjs.com/package/mongodb-lens)
- [GitHub Repository](https://github.com/furey/mongodb-lens)
- [GitHub Documentation](https://github.com/furey/mongodb-lens/blob/main/README.md)

## Disclaimer

MongoDB Lens:

- is licensed under the [MIT License](./LICENSE).
- is not affiliated with or endorsed by MongoDB, Inc.
- is written with the assistance of AI and may contain errors.
- is intended for educational and experimental purposes only.
- is provided as-is with no warranty or support—use at your own risk.

## Support

If you've found MongoDB Lens helpful consider supporting my work through:

[Buy Me a Coffee](https://www.buymeacoffee.com/furey) | [GitHub Sponsorship](https://github.com/sponsors/furey)

Contributions help me continue developing and improving this tool, allowing me to dedicate more time to add new features and ensuring it remains a valuable resource for the community.
