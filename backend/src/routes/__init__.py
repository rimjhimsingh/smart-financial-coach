from flask import Blueprint
from .main import main_bp
from .dashboard import dashboard_bp

api_bp = Blueprint("api", __name__, url_prefix="/api")

api_bp.register_blueprint(main_bp)
api_bp.register_blueprint(dashboard_bp)
