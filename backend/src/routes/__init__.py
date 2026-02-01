"""
API Blueprint Aggregator
------------------------
Combines all route blueprints under a single API blueprint.
"""
from __future__ import annotations

from flask import Blueprint

from .copilot import copilot_bp
from .dashboard import dashboard_bp
from .main import main_bp
from .subscriptions import subscriptions_bp

api_bp = Blueprint("api", __name__)

api_bp.register_blueprint(main_bp)
api_bp.register_blueprint(dashboard_bp)
api_bp.register_blueprint(subscriptions_bp)
api_bp.register_blueprint(copilot_bp)
