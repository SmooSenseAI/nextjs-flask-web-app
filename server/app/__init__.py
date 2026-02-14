"""Flask application factory."""

import os
from flask import Flask

from app.handlers.api import api_bp
from app.handlers.etrade import etrade_bp
from app.handlers.pages import pages_bp


def create_app() -> Flask:
    """Create and configure the Flask application."""
    static_folder = os.path.join(os.path.dirname(__file__), "statics")

    app = Flask(
        __name__,
        static_folder=static_folder if os.path.exists(static_folder) else None,
        static_url_path="",
    )

    # Register blueprints
    app.register_blueprint(api_bp, url_prefix="/api")
    app.register_blueprint(etrade_bp, url_prefix="/api/etrade")
    app.register_blueprint(pages_bp, url_prefix="")

    return app
