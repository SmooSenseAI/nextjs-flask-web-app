"""CLI entry point."""

import click
import webbrowser
from threading import Timer

from app import create_app


@click.group(invoke_without_command=True)
@click.option("--version", is_flag=True, help="Show version and exit.")
@click.pass_context
def main(ctx: click.Context, version: bool) -> None:
    """Web App - Next.js + Flask application."""
    if version:
        from importlib.metadata import version as get_version

        click.echo(f"webapp {get_version('webapp')}")
        return

    if ctx.invoked_subcommand is None:
        ctx.invoke(serve)


@main.command()
@click.option("--host", default="127.0.0.1", help="Host to bind to.")
@click.option("--port", default=8000, help="Port to bind to.")
@click.option("--no-browser", is_flag=True, help="Don't open browser automatically.")
def serve(host: str, port: int, no_browser: bool) -> None:
    """Start the web server."""
    app = create_app()

    if not no_browser:
        url = f"http://{host}:{port}"
        Timer(1.0, lambda: webbrowser.open(url)).start()
        click.echo(f"Opening {url} in browser...")

    app.run(host=host, port=port, debug=False)


if __name__ == "__main__":
    main()
