"""AttackTrace MCP Host CLI."""

import asyncio

from attacktrace_mcp_host.cli.cli import run


def main() -> None:
    """attacktrace_mcp_host CLI entrypoint."""
    asyncio.run(run())
