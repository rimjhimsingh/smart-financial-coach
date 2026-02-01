"""
Application Factory
-------------------
This module builds and configures the Flask application instance.

It follows the application factory pattern so the app can be created consistently across
different environments and contexts (local run, tests, deployments).

What it does:
- Creates the Flask app instance.
- Loads configuration from environment driven settings via load_config and applies optional
  overrides passed at creation time.
- Configures CORS for API routes, using configured origins with sensible local defaults.
- Registers the aggregated API blueprint under the /api prefix so all route modules are
  reachable from a single base path.
"""

from __future__ import annotations

from typing import Any, Mapping, Optional

from flask import Flask
from flask_cors import CORS

from .config import load_config
from .routes import api_bp


def create_app(config_overrides: Optional[Mapping[str, Any]] = None) -> Flask:
    app = Flask(__name__)

    cfg = load_config()
    app.config.update(cfg)

    if config_overrides:
        app.config.update(config_overrides)

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": app.config.get(
                    "CORS_ORIGINS",
                    ["http://localhost:5173", "http://127.0.0.1:5173"],
                )
            }
        },
        supports_credentials=bool(app.config.get("CORS_SUPPORTS_CREDENTIALS", False)),
    )

    app.register_blueprint(api_bp, url_prefix="/api")

    return app
