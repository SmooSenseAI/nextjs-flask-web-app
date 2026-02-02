"""Page routes for serving the frontend."""

import os
from flask import Blueprint, send_from_directory, current_app

pages_bp = Blueprint("pages", __name__)


def get_static_folder() -> str | None:
    """Get the static folder path."""
    return current_app.static_folder


@pages_bp.route("/")
def index():
    """Serve the main page."""
    static_folder = get_static_folder()
    if static_folder and os.path.exists(os.path.join(static_folder, "index.html")):
        return send_from_directory(static_folder, "index.html")
    return """
    <html>
    <head><title>Web App</title></head>
    <body>
        <h1>Web App Backend</h1>
        <p>Frontend not built yet. Run <code>make build</code> from the root directory.</p>
        <p>API available at <a href="/api/health">/api/health</a></p>
    </body>
    </html>
    """


@pages_bp.route("/<path:path>")
def catch_all(path: str):
    """Serve static files or fall back to index.html for SPA routing."""
    static_folder = get_static_folder()
    if not static_folder:
        return "Not found", 404

    # Try to serve the exact file
    file_path = os.path.join(static_folder, path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_from_directory(static_folder, path)

    # Try with .html extension (Next.js static export)
    html_path = os.path.join(static_folder, f"{path}.html")
    if os.path.exists(html_path):
        return send_from_directory(static_folder, f"{path}.html")

    # Fall back to index.html for client-side routing
    index_path = os.path.join(static_folder, "index.html")
    if os.path.exists(index_path):
        return send_from_directory(static_folder, "index.html")

    return "Not found", 404
