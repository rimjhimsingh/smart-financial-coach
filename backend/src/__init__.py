"""
Application Factory Module
--------------------------
Implements the Application Factory pattern and registers blueprints.
"""
from flask import Flask
from flask_cors import CORS

from .config import load_config
from .routes import api_bp


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

    cfg = load_config()
    app.config.update(cfg)

    # Register API blueprint under /api
    app.register_blueprint(api_bp)

    return app
