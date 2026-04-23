"""AttackTrace MCP Host CLI."""

import asyncio

from oap_mcp_host.cli.cli import run


def main() -> None:
    """oap_mcp_host CLI entrypoint."""
    asyncio.run(run())
