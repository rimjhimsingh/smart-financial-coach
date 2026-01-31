from flask import Blueprint
from .main import main_bp
from .dashboard import dashboard_bp
from .subscriptions import subscriptions_bp
from .copilot import copilot_bp
api_bp = Blueprint("api", __name__, url_prefix="/api")

api_bp.register_blueprint(main_bp)
api_bp.register_blueprint(dashboard_bp)
api_bp.register_blueprint(subscriptions_bp)
api_bp.register_blueprint(copilot_bp)
