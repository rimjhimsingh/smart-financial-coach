from flask import Blueprint
from .main import main_bp

api_bp = Blueprint("api", __name__, url_prefix="/api")

# Only register what exists right now
api_bp.register_blueprint(main_bp)
